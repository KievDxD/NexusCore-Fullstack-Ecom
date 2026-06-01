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
  agregarProducto: (producto: Producto, cantidad?: number) => void;
  eliminarProducto: (id: number) => void;
  limpiarCarrito: () => void;
}

export const useCarrito = create<CarritoState>()(
  persist(
    (set) => ({
      items: [],

      agregarProducto: (producto, cantidad = 1) => set((state) => {
        const existe = state.items.find((item) => item.id === producto.id);
        const stock = producto.stock ?? 10;
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
                item.id === producto.id ? { ...item, cantidad: stock } : item
              ),
            };
          }
          return { items: [...state.items, { ...producto, cantidad: stock }] };
        }

        if (existe) {
          return {
            items: state.items.map((item) =>
              item.id === producto.id ? { ...item, cantidad: nuevaCantidad } : item
            ),
          };
        }
        return { items: [...state.items, { ...producto, cantidad: cantidad }] };
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