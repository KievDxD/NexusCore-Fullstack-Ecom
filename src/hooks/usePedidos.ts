import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { CartItem, EstadoPedido, MetodoPago, Moneda, Pedido, PedidoItem } from '../types';
import { precioConDescuento } from '../utils/currency';
import { useProductosStore, invalidateProductoDetalleCache } from './useProductos';

interface CrearPedidoParams {
  clienteNombre: string;
  clienteTelefono: string;
  metodoPago: MetodoPago;
  moneda: Moneda;
  itemsCarrito: CartItem[];
}

interface PedidosState {
  pedidos: Pedido[];
  cargando: boolean;
  fetchPedidos: () => Promise<void>;
  crearPedidoConReserva: (params: CrearPedidoParams) => Promise<Pedido>;
  cambiarEstadoPedido: (pedidoId: string, nuevoEstado: EstadoPedido, referenciaPago?: string) => Promise<Pedido>;
}

// Genera el hash SHA-256 oficial requerido por Wompi Colombia:
// SHA256(Referencia + MontoEnCentavos + Moneda + SecretoIntegridad)
export async function generarFirmaIntegridadWompi(
  referencia: string,
  montoEnCentavos: number,
  moneda = 'COP',
  secret = import.meta.env.VITE_WOMPI_INTEGRITY_SECRET || 'test_integrity_nexuscore_sandbox_secret'
): Promise<string> {
  const cadena = `${referencia}${Math.round(montoEnCentavos)}${moneda}${secret}`;
  const buffer = new TextEncoder().encode(cadena);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const usePedidosStore = create<PedidosState>()(
  persist(
    (set, get) => ({
      pedidos: [],
      cargando: false,

      fetchPedidos: async () => {
        set({ cargando: true });
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .select('id, user_id, cliente_nombre, cliente_telefono, metodo_pago, moneda, total, estado, referencia_pago, items, created_at')
            .order('created_at', { ascending: false })
            .range(0, 49);

          if (!error && data) {
            set({ pedidos: data as unknown as Pedido[] });
          }
        } catch (err) {
          console.warn('Usando historial local de pedidos:', err);
        } finally {
          set({ cargando: false });
        }
      },

      crearPedidoConReserva: async ({ clienteNombre, clienteTelefono, metodoPago, moneda, itemsCarrito }) => {
        if (itemsCarrito.length === 0) {
          throw new Error('El carrito está vacío.');
        }

        const productosActuales = useProductosStore.getState().productos;
        // 1. Verificación preventiva en cliente antes de la transacción RPC
        for (const item of itemsCarrito) {
          const prodEnCatalogo = productosActuales.find((p) => p.id === item.id);
          const stockDisp = prodEnCatalogo ? prodEnCatalogo.stock : item.stock;
          if (stockDisp < item.cantidad) {
            throw new Error(
              `Stock insuficiente para "${item.nombre}". Disponibles: ${stockDisp}, solicitados: ${item.cantidad}.`
            );
          }
        }

        const itemsPayload: PedidoItem[] = itemsCarrito.map((item) => ({
          producto_id: item.id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: precioConDescuento(item),
          imagen: item.imagen,
        }));

        const totalCOP = itemsPayload.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);

        // 2. Ejecutar RPC transaccional en PostgreSQL/Supabase
        const { data: rpcData, error: rpcError } = await supabase.rpc('crear_pedido_y_reservar_stock', {
          p_cliente_nombre: clienteNombre.trim() || 'Cliente Nexus',
          p_cliente_telefono: clienteTelefono.trim(),
          p_metodo_pago: metodoPago,
          p_moneda: moneda,
          p_items: itemsPayload,
        });

        let pedidoCreado: Pedido;

        if (!rpcError && rpcData) {
          pedidoCreado = rpcData as unknown as Pedido;
        } else {
          // Si la RPC reportó explícitamente stock insuficiente, propagar el error
          if (rpcError?.message?.toLowerCase().includes('stock insuficiente')) {
            throw new Error(rpcError.message);
          }

          // Fallback: descontar stock directamente en la tabla productos de Supabase
          for (const item of itemsCarrito) {
            const prodEnCatalogo = productosActuales.find((p) => p.id === item.id);
            const nuevoStock = Math.max(0, (prodEnCatalogo?.stock ?? item.stock) - item.cantidad);
            await supabase.from('productos').update({ stock: nuevoStock }).eq('id', item.id);
          }

          pedidoCreado = {
            id: crypto.randomUUID ? crypto.randomUUID() : `nx-${Date.now()}`,
            cliente_nombre: clienteNombre.trim() || 'Cliente Nexus',
            cliente_telefono: clienteTelefono.trim(),
            metodo_pago: metodoPago,
            moneda,
            total: totalCOP,
            estado: 'pendiente',
            items: itemsPayload,
            created_at: new Date().toISOString(),
          };
        }

        // 3. Reflejar inmediatamente la reserva de stock en el store global de productos
        useProductosStore.setState((state) => ({
          productos: state.productos.map((prod) => {
            const reservado = itemsPayload.find((i) => i.producto_id === prod.id);
            if (!reservado) return prod;
            return {
              ...prod,
              stock: Math.max(0, (prod.stock ?? 0) - reservado.cantidad),
            };
          }),
        }));
        invalidateProductoDetalleCache();

        set((state) => ({
          pedidos: [pedidoCreado, ...state.pedidos.filter((p) => p.id !== pedidoCreado.id)],
        }));

        return pedidoCreado;
      },

      cambiarEstadoPedido: async (pedidoId, nuevoEstado, referenciaPago) => {
        const pedidoActual = get().pedidos.find((p) => p.id === pedidoId);
        const estadoAnterior = pedidoActual?.estado ?? 'pendiente';

        // 1. Llamar a la RPC de Supabase (que activa el trigger de devolución de stock si pasa de pendiente -> cancelado)
        const { data: rpcData, error: rpcError } = await supabase.rpc('cambiar_estado_pedido', {
          p_pedido_id: pedidoId,
          p_nuevo_estado: nuevoEstado,
          p_referencia_pago: referenciaPago ?? null,
        });

        // Si la migración RPC no estaba activa, devolver el stock por cliente en caso de cancelación
        if (rpcError && estadoAnterior === 'pendiente' && nuevoEstado === 'cancelado' && pedidoActual) {
          const productosActuales = useProductosStore.getState().productos;
          for (const item of pedidoActual.items) {
            const prod = productosActuales.find((p) => p.id === item.producto_id);
            if (prod) {
              await supabase
                .from('productos')
                .update({ stock: (prod.stock ?? 0) + item.cantidad })
                .eq('id', prod.id);
            }
          }
        }

        // 2. Si pasa de 'pendiente' a 'cancelado', restaurar el stock inmediatamente en la UI
        if (estadoAnterior === 'pendiente' && nuevoEstado === 'cancelado' && pedidoActual) {
          useProductosStore.setState((state) => ({
            productos: state.productos.map((prod) => {
              const item = pedidoActual.items.find((i) => i.producto_id === prod.id);
              if (!item) return prod;
              return {
                ...prod,
                stock: (prod.stock ?? 0) + item.cantidad,
              };
            }),
          }));
          invalidateProductoDetalleCache();
        }

        const pedidoActualizado: Pedido =
          !rpcError && rpcData
            ? (rpcData as unknown as Pedido)
            : {
                ...(pedidoActual as Pedido),
                id: pedidoId,
                estado: nuevoEstado,
                referencia_pago: referenciaPago ?? pedidoActual?.referencia_pago,
              };

        set((state) => ({
          pedidos: state.pedidos.map((p) => (p.id === pedidoId ? pedidoActualizado : p)),
        }));

        return pedidoActualizado;
      },
    }),
    {
      name: 'nexus_pedidos_cache_v1',
      partialize: (state) => ({ pedidos: state.pedidos }),
    }
  )
);

