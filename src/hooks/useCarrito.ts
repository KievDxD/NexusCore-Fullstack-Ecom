import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 1. Estructura exacta de lo que viene de la base de datos (Supabase)
export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  categoria: string;
  descripcion: string;
  stock: number;
  descripcion_larga?: string;
  especificaciones?: Record<string, string>;
  marca?: string;
  imagenes?: { id: number; url: string; orden: number }[];
}

// 2. Un CartItem es un Producto, pero con la propiedad extra de "cantidad"
export interface CartItem extends Producto {
  cantidad: number;
}

interface CarritoState {
  items: CartItem[];
  agregarProducto: (producto: Producto) => void;
  eliminarProducto: (id: number) => void;
  limpiarCarrito: () => void;
}

export const useCarrito = create<CarritoState>()(
  persist(
    (set) => ({
      items: [],

      agregarProducto: (producto) => set((state) => {
        const existe = state.items.find((item) => item.id === producto.id);
        
        if (existe) {
          // Buscamos el producto y le sumamos 1 a 'cantidad'
          return {
            items: state.items.map((item) =>
              item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
            ),
          };
        }
        // Si es nuevo, lo metemos con cantidad inicial de 1
        return { items: [...state.items, { ...producto, cantidad: 1 }] };
      }),

      eliminarProducto: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),

      limpiarCarrito: () => set({ items: [] }),
    }),
    {
      name: 'carrito-storage', // Guarda el carrito en el navegador
    }
  )
);