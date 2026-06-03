import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProductosStore } from './useProductos';

// 1. Estructura exacta de lo que viene de la base de datos (Supabase)
export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  categoria: string;
  descripcion: string;
  stock: number;
  descuento?: number;
  descripcion_larga?: string;
  especificaciones?: Record<string, string>;
  marca?: string;
  imagenes?: { id: number; url: string; orden: number }[];
}

// 2. Un CartItem es un Producto, pero con la propiedad extra de "cantidad"
export interface CartItem extends Producto {
  cantidad: number;
}

export interface CartItemPersisted {
  id: number;
  cantidad: number;
}

interface CarritoState {
  items: CartItemPersisted[];
  agregarProducto: (producto: Producto, cantidad?: number) => void;
  eliminarProducto: (id: number) => void;
  limpiarCarrito: () => void;
}

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set) => ({
      items: [],

      agregarProducto: (producto, cantidad = 1) => set((state) => {
        // Obtenemos el stock más fresco desde useProductosStore
        const productosGlobal = useProductosStore.getState().productos;
        const productoFresco = productosGlobal.find(p => p.id === producto.id) || producto;
        
        const existe = state.items.find((item) => item.id === producto.id);
        const stock = productoFresco.stock ?? 10;
        const cantidadActual = existe ? existe.cantidad : 0;
        const nuevaCantidad = cantidadActual + cantidad;

        if (nuevaCantidad > stock) {
          // Si supera el stock, limitamos a la cantidad máxima disponible
          const cantPermitida = stock - cantidadActual;
          if (cantPermitida <= 0) {
            return state;
          }
          if (existe) {
            return {
              items: state.items.map((item) =>
                item.id === producto.id ? { id: item.id, cantidad: stock } : item
              ),
            };
          }
          return { items: [...state.items, { id: producto.id, cantidad: stock }] };
        }

        if (existe) {
          return {
            items: state.items.map((item) =>
              item.id === producto.id ? { id: item.id, cantidad: nuevaCantidad } : item
            ),
          };
        }
        return { items: [...state.items, { id: producto.id, cantidad }] };
      }),

      eliminarProducto: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),

      limpiarCarrito: () => set({ items: [] }),
    }),
    {
      name: 'carrito-storage', // Guarda el carrito en el navegador
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Custom hook que cruza los items persistidos con el catálogo fresco de Supabase
export function useCarrito() {
  const store = useCarritoStore();
  const productosGlobal = useProductosStore(state => state.productos);

  const itemsCompletos: CartItem[] = store.items.map(item => {
    // Buscar el producto en el catálogo actualizado
    const prodFresco = productosGlobal.find(p => p.id === item.id);
    
    // Si lo encuentra, inyectar el precio y stock actual. 
    if (prodFresco) {
      // Usamos el stock fresco para limitar la cantidad si el stock bajó en el backend
      const stockDisponible = prodFresco.stock ?? 10;
      const cantidadSegura = Math.min(item.cantidad, stockDisponible);
      return { ...prodFresco, cantidad: cantidadSegura };
    }
    
    // Fallback temporal si el catálogo no ha cargado
    return {
      id: item.id,
      nombre: 'Cargando producto...',
      precio: 0,
      imagen: 'https://placehold.co/600x400/1e293b/475569?text=Cargando...',
      categoria: '',
      descripcion: '',
      stock: 0,
      cantidad: item.cantidad
    } as CartItem;
  });

  return { ...store, items: itemsCompletos };
}