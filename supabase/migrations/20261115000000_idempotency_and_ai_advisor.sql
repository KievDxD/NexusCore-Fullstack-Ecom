-- =================================================================================
-- MIGRACIÓN V2.0 ENTERPRISE: IDEMPOTENCIA TRANSACCIONAL EN PEDIDOS Y PAGOS
-- =================================================================================

-- 1. Columna idempotency_key UNIQUE en public.pedidos para prevenir cargos o reservas duplicadas
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;

CREATE INDEX IF NOT EXISTS idx_pedidos_idempotency_key
  ON public.pedidos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_referencia_pago
  ON public.pedidos (referencia_pago)
  WHERE referencia_pago IS NOT NULL;

-- 2. RPC Transaccional Idempotente: Crear pedido y reservar stock atómicamente
DROP FUNCTION IF EXISTS public.crear_pedido_y_reservar_stock(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.crear_pedido_y_reservar_stock(text, text, text, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.crear_pedido_y_reservar_stock(
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_metodo_pago text,
  p_moneda text,
  p_items jsonb,
  p_idempotency_key uuid DEFAULT NULL
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
  -- Serialización transaccional por clave de idempotencia ante reintentos o dobles clics simultáneos
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

    SELECT *
    INTO v_pedido
    FROM public.pedidos
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN to_jsonb(v_pedido);
    END IF;
  END IF;

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
    items,
    idempotency_key
  )
  VALUES (
    (SELECT auth.uid()),
    COALESCE(NULLIF(btrim(p_cliente_nombre), ''), 'Cliente Nexus'),
    COALESCE(btrim(p_cliente_telefono), ''),
    CASE WHEN p_metodo_pago IN ('whatsapp', 'wompi') THEN p_metodo_pago ELSE 'whatsapp' END,
    COALESCE(NULLIF(btrim(p_moneda), ''), 'COP'),
    v_total,
    'pendiente',
    p_items,
    p_idempotency_key
  )
  RETURNING * INTO v_pedido;

  RETURN to_jsonb(v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_y_reservar_stock(text, text, text, text, jsonb, uuid) TO anon, authenticated;

-- 3. RPC Idempotente para cambio de estado (Tolerante a reintentos de Webhook y dobles clics)
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

  -- Bloquear la fila del pedido para evitar condiciones de carrera en reintentos concurrentes
  SELECT *
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado.', p_pedido_id;
  END IF;

  -- Idempotencia: si ya tiene el mismo estado o la misma referencia finalizada, devolver sin re-ejecutar triggers
  IF v_pedido.estado = p_nuevo_estado THEN
    RETURN to_jsonb(v_pedido);
  END IF;

  IF v_pedido.referencia_pago IS NOT NULL
     AND p_referencia_pago IS NOT NULL
     AND v_pedido.referencia_pago = p_referencia_pago
     AND v_pedido.estado IN ('pagado', 'cancelado') THEN
    RETURN to_jsonb(v_pedido);
  END IF;

  UPDATE public.pedidos
  SET
    estado = p_nuevo_estado,
    referencia_pago = COALESCE(p_referencia_pago, referencia_pago)
  WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

  RETURN to_jsonb(v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) TO anon, authenticated;

