import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type Producto } from './useCarrito'; // Reutilizamos tu tipo de datos

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function fetchProductos() {
      try {
        const { data, error } = await supabase.from('productos').select('*');
        
        if (error) {
          console.error("Error en Supabase:", error);
          setProductos([]); // Fallback: array vacío ante error
        } else {
          setProductos(data || []);
        }
      } catch (err) {
        console.error("Error inesperado:", err);
        setProductos([]);
      } finally {
        setCargando(false);
      }
    }
    fetchProductos();
  }, []);

  return { productos, cargando };
}