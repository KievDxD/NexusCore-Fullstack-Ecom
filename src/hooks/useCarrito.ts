import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProductosStore } from './useProductos';
import { precioConDescuento } from '../utils/currency';
import type { CartItem, CartItemPersisted, Producto } from '../types';

// Re-exports de compatibilidad: los tipos ahora viven en src/types
export type { Producto, CartItem, CartItemPersisted } from '../types';

const STOCK_POR_DEFECTO = 10;

interface CarritoState {
  items: CartItemPersisted[];
  /** Devuelve `true` si se añadió al menos una unidad; `false` si el stock ya estaba agotado. */
  agregarProducto: (producto: Producto, cantidad?: number) => boolean;
  eliminarProducto: (id: number) => void;
  limpiarCarrito: () => void;
  sincronizarConCatalogo: (catalogo: Producto[]) => void;
}

export const MENSAJE_LIMITE_STOCK = 'Has alcanzado el límite de stock disponible para este producto';

const stockFresco = (producto: Producto): number => {
  const fresco = useProductosStore.getState().productos.find((p) => p.id === producto.id) ?? producto;
  return fresco.stock ?? STOCK_POR_DEFECTO;
};

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],

      agregarProducto: (producto, cantidad = 1) => {
        if (cantidad <= 0) return false;

        const stock = stockFresco(producto);
        const actual = get().items.find((i) => i.id === producto.id);
        const cantidadActual = actual?.cantidad ?? 0;

        // Guardián: si ya se alcanzó el stock no se toca el estado (evita re-renders y bucles)
        if (cantidadActual >= stock) return false;

        // Nunca superar el stock disponible
        const nuevaCantidad = Math.min(cantidadActual + cantidad, stock);

        set((state) => ({
          items: actual
            ? state.items.map((i) => (i.id === producto.id ? { id: i.id, cantidad: nuevaCantidad } : i))
            : [...state.items, { id: producto.id, cantidad: nuevaCantidad }],
        }));
        return true;
      },

      eliminarProducto: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      limpiarCarrito: () => set({ items: [] }),

      // Elimina productos que ya no existen / sin stock y ajusta cantidades al stock real.
      // Se ejecuta solo con un catálogo real de Supabase (ver suscripción al final del archivo).
      sincronizarConCatalogo: (catalogo) =>
        set((state) => {
          const porId = new Map(catalogo.map((p) => [p.id, p]));
          let cambio = false;
          const items: CartItemPersisted[] = [];

          for (const item of state.items) {
            const prod = porId.get(item.id);
            const stock = prod ? (prod.stock ?? STOCK_POR_DEFECTO) : 0;
            if (!prod || stock <= 0) {
              cambio = true;
              continue;
            }
            const cantidad = Math.min(item.cantidad, stock);
            if (cantidad !== item.cantidad) cambio = true;
            items.push({ id: item.id, cantidad });
          }

          return cambio ? { items } : state;
        }),
    }),
    {
      name: 'carrito-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Cuando llega el catálogo real, depuramos el carrito persistido
useProductosStore.subscribe((state, prev) => {
  if (state.productos === prev.productos || state.ultimaActualizacion === 0) return;
  useCarritoStore.getState().sincronizarConCatalogo(state.productos);
});

const placeholderPendiente = (item: CartItemPersisted): CartItem => ({
  id: item.id,
  nombre: 'Cargando producto...',
  precio: 0,
  imagen: 'https://placehold.co/600x400/1e293b/475569?text=Cargando...',
  categoria: '',
  descripcion: '',
  stock: 0,
  cantidad: item.cantidad,
  pendiente: true,
});

/** Total de unidades en el carrito (primitivo: el Navbar solo re-renderiza si cambia el número). */
export const useCarritoCount = () =>
  useCarritoStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));

/** Unidades de un producto ya en el carrito (primitivo: solo re-renderiza si cambia ESE producto). */
export const useCantidadEnCarrito = (id: number) =>
  useCarritoStore((s) => s.items.find((i) => i.id === id)?.cantidad ?? 0);

/** Solo las acciones: componentes como TarjetaProducto no se re-renderizan al cambiar el carrito. */
export const useCarritoActions = () => {
  const agregarProducto = useCarritoStore((s) => s.agregarProducto);
  const eliminarProducto = useCarritoStore((s) => s.eliminarProducto);
  const limpiarCarrito = useCarritoStore((s) => s.limpiarCarrito);
  return { agregarProducto, eliminarProducto, limpiarCarrito };
};

/** Cruza los items persistidos con el catálogo fresco. Memoizado y con lookup O(1). */
export function useCarrito() {
  const itemsPersistidos = useCarritoStore((s) => s.items);
  const productos = useProductosStore((s) => s.productos);
  const { agregarProducto, eliminarProducto, limpiarCarrito } = useCarritoActions();

  const items = useMemo<CartItem[]>(() => {
    const porId = new Map(productos.map((p) => [p.id, p]));
    return itemsPersistidos.map((item) => {
      const prod = porId.get(item.id);
      if (!prod) return placeholderPendiente(item);
      const stock = prod.stock ?? STOCK_POR_DEFECTO;
      return { ...prod, cantidad: Math.min(item.cantidad, stock) };
    });
  }, [itemsPersistidos, productos]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + precioConDescuento(i) * i.cantidad, 0),
    [items]
  );
  const hayPendientes = useMemo(() => items.some((i) => i.pendiente), [items]);

  return { items, total, hayPendientes, agregarProducto, eliminarProducto, limpiarCarrito };
}
