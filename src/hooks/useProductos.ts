import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { type Producto } from './useCarrito';
import { LISTA_PRODUCTOS } from '../data/productos';

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function fetchProductos() {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .order('id', { ascending: true });
        
        if (error || !data || data.length === 0) {
          console.warn("Usando catálogo local (fallback) debido a error o base de datos vacía");
          setProductos(LISTA_PRODUCTOS);
        } else {
          setProductos(data || []);
        }
      } catch (err) {
        console.error("Error inesperado en fetch de productos, usando fallback:", err);
        setProductos(LISTA_PRODUCTOS);
      } finally {
        setCargando(false);
      }
    }
    fetchProductos();
  }, []);

  // 🆕 Envolver en useCallback para evitar recreaciones de función en cada render
  // y resolver el bucle infinito de carga en la página de detalle.
  const fetchProductoById = useCallback(async (id: number) => {
    try {
      // 1. Obtener producto con sus imágenes adicionales
      const { data: producto, error: prodError } = await supabase
        .from('productos')
        .select(`
          *,
          imagenes: producto_imagenes(id, url, orden)
        `)
        .eq('id', id)
        .single();
      
      if (prodError || !producto) {
        throw prodError || new Error("Producto no encontrado");
      }
      
      // 2. Obtener reseñas del producto con el perfil del autor
      const { data: resenas, error: resError } = await supabase
        .from('resenas')
        .select(`
          id,
          puntuacion,
          comentario,
          created_at,
          user_id,
          profiles(username, avatar_url)
        `)
        .eq('producto_id', id)
        .order('created_at', { ascending: false });

      return {
        producto: {
          ...producto,
          imagenes: (producto.imagenes || []).sort((a: any, b: any) => a.orden - b.orden)
        },
        resenas: resError ? [] : (resenas as any[])
      };
    } catch (err) {
      console.warn(`Fallo fetch del producto #${id} en Supabase, usando fallback local:`, err);
      
      const localProd = LISTA_PRODUCTOS.find(p => p.id === id);
      if (!localProd) return null;
      
      // Galería mockeada con imágenes acordes al hardware
      const mockImages = [
        { id: 101, url: localProd.imagen, orden: 0 },
        { id: 102, url: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?q=80&w=600", orden: 1 },
        { id: 103, url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?q=80&w=600", orden: 2 }
      ];

      // Reseñas mockeadas
      const mockReviews = [
        {
          id: 1,
          puntuacion: 5,
          comentario: "Una excelente adición a mi torre gamer. Funciona extremadamente estable y mantiene temperaturas bajas.",
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          profiles: { username: "kiev_gamer", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=1" }
        },
        {
          id: 2,
          puntuacion: 4,
          comentario: "Muy buena calidad de construcción, la marca es de total confianza.",
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          profiles: { username: "nexus_builder", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=2" }
        }
      ];

      return {
        producto: {
          ...localProd,
          imagenes: mockImages
        },
        resenas: mockReviews
      };
    }
  }, []);

  return { productos, cargando, fetchProductoById };
}