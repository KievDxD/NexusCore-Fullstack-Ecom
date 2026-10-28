-- =================================================================================
-- MIGRACIÓN: RESERVA DE STOCK CON TRANSACCIONES (RPC), PEDIDOS Y COMPATIBILIDAD PC BUILDER
-- =================================================================================

-- 1. Columna opcional specs (JSONB) sincronizada con especificaciones para consultas rápidas en PC Builder
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_productos_specs_gin
  ON public.productos USING gin (specs);

CREATE INDEX IF NOT EXISTS idx_productos_especificaciones_gin
  ON public.productos USING gin (especificaciones);

-- 2. Tabla de Pedidos (Orders) con estados: pendiente, pagado, cancelado
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_nombre text NOT NULL DEFAULT 'Cliente Nexus',
  cliente_telefono text NOT NULL DEFAULT '',
  metodo_pago text NOT NULL DEFAULT 'whatsapp' CHECK (metodo_pago IN ('whatsapp', 'wompi')),
  moneda text NOT NULL DEFAULT 'COP',
  total numeric NOT NULL CHECK (total >= 0),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'cancelado')),
  referencia_pago text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pedidos_user_id ON public.pedidos (user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_created ON public.pedidos (estado, created_at DESC);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de pedidos propios o admin" ON public.pedidos;
CREATE POLICY "Lectura de pedidos propios o admin"
  ON public.pedidos FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Actualizacion de pedidos solo admin" ON public.pedidos;
CREATE POLICY "Actualizacion de pedidos solo admin"
  ON public.pedidos FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Trigger para devolver automáticamente el stock cuando un pedido pasa a 'cancelado'
CREATE OR REPLACE FUNCTION public.fn_restaurar_stock_pedido_cancelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_prod_id bigint;
  v_cantidad int;
BEGIN
  -- Solo devolver stock si el pedido estaba en 'pendiente' y pasa a 'cancelado'
  IF OLD.estado = 'pendiente' AND NEW.estado = 'cancelado' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      v_prod_id := (v_item->>'producto_id')::bigint;
      v_cantidad := COALESCE((v_item->>'cantidad')::int, 0);
      IF v_prod_id IS NOT NULL AND v_cantidad > 0 THEN
        UPDATE public.productos
        SET stock = COALESCE(stock, 0) + v_cantidad
        WHERE id = v_prod_id;
      END IF;
    END LOOP;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurar_stock_pedido ON public.pedidos;
CREATE TRIGGER trg_restaurar_stock_pedido
  BEFORE UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_restaurar_stock_pedido_cancelado();

-- 4. RPC Transaccional: Crear pedido y apartar stock atómicamente
CREATE OR REPLACE FUNCTION public.crear_pedido_y_reservar_stock(
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_metodo_pago text,
  p_moneda text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_prod_id bigint;
  v_cantidad int;
  v_stock_actual int;
  v_precio numeric;
  v_descuento int;
  v_nombre_prod text;
  v_total numeric := 0;
  v_pedido public.pedidos;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- Validar y descontar stock con bloqueo de fila (FOR UPDATE)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'producto_id')::bigint;
    v_cantidad := COALESCE((v_item->>'cantidad')::int, 0);

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto ID %', v_prod_id;
    END IF;

    SELECT stock, precio, COALESCE(descuento, 0), nombre
    INTO v_stock_actual, v_precio, v_descuento, v_nombre_prod
    FROM public.productos
    WHERE id = v_prod_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe.', v_prod_id;
    END IF;

    IF COALESCE(v_stock_actual, 0) < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": disponibles %, solicitados %.', v_nombre_prod, COALESCE(v_stock_actual, 0), v_cantidad;
    END IF;

    UPDATE public.productos
    SET stock = COALESCE(stock, 0) - v_cantidad
    WHERE id = v_prod_id;

    v_total := v_total + ROUND(v_precio * (1 - v_descuento / 100.0)) * v_cantidad;
  END LOOP;

  INSERT INTO public.pedidos (
    user_id,
    cliente_nombre,
    cliente_telefono,
    metodo_pago,
    moneda,
    total,
    estado,
    items
  )
  VALUES (
    (SELECT auth.uid()),
    COALESCE(NULLIF(btrim(p_cliente_nombre), ''), 'Cliente Nexus'),
    COALESCE(btrim(p_cliente_telefono), ''),
    CASE WHEN p_metodo_pago IN ('whatsapp', 'wompi') THEN p_metodo_pago ELSE 'whatsapp' END,
    COALESCE(NULLIF(btrim(p_moneda), ''), 'COP'),
    v_total,
    'pendiente',
    p_items
  )
  RETURNING * INTO v_pedido;

  RETURN to_jsonb(v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_y_reservar_stock(text, text, text, text, jsonb) TO anon, authenticated;

-- 5. RPC para actualizar el estado de un pedido (Admin o confirmación de pasarela)
CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(
  p_pedido_id uuid,
  p_nuevo_estado text,
  p_referencia_pago text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos;
BEGIN
  IF p_nuevo_estado NOT IN ('pendiente', 'pagado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de pedido no válido: %', p_nuevo_estado;
  END IF;

  UPDATE public.pedidos
  SET
    estado = p_nuevo_estado,
    referencia_pago = COALESCE(p_referencia_pago, referencia_pago)
  WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado.', p_pedido_id;
  END IF;

  RETURN to_jsonb(v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) TO anon, authenticated;

