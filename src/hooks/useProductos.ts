import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { type Producto } from './useCarrito';
import { LISTA_PRODUCTOS } from '../data/productos';

interface ProductosState {
  productos: Producto[];
  cargando: boolean;
  yaIntento: boolean;
  fetchProductos: () => Promise<void>;
}

export const useProductosStore = create<ProductosState>((set, get) => ({
  productos: [],
  cargando: true,
  yaIntento: false,
  fetchProductos: async () => {
    if (get().yaIntento) return;
    set({ cargando: true, yaIntento: true });

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));

    try {
      const fetchPromise = supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true });

      const result = await Promise.race([fetchPromise, timeout]);

      if (!result || 'error' in result === false) {
        console.warn("Timeout de conexion con Supabase, usando catalogo local");
        set({ productos: LISTA_PRODUCTOS, cargando: false });
        return;
      }

      const { data, error } = result as { data: Producto[] | null; error: unknown };

      if (error || !data || data.length === 0) {
        console.warn("Usando catalogo local (fallback) debido a error o base de datos vacia");
        set({ productos: LISTA_PRODUCTOS });
      } else {
        set({ productos: data });
      }
    } catch (err) {
      console.error("Error inesperado en fetch de productos, usando fallback:", err);
      set({ productos: LISTA_PRODUCTOS });
    } finally {
      set({ cargando: false });
    }
  }
}));

export function useProductos() {
  const { productos, cargando, fetchProductos } = useProductosStore();

  useEffect(() => {
    if (productos.length === 0 && !useProductosStore.getState().yaIntento) {
      fetchProductos();
    }
  }, [productos.length, fetchProductos]);

  const fetchProductoById = useCallback(async (id: number) => {
    let finalProducto: Producto | null;
    let finalResenas: Array<{ id: number; puntuacion: number; comentario: string; created_at: string; profiles: { username: string; avatar_url: string } | null }>;

    // 1. Obtener producto principal
    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (prodError || !producto) {
      console.warn(`Fallo al obtener producto #${id} desde Supabase:`, prodError);
      const localProd = LISTA_PRODUCTOS.find(p => p.id === id);
      if (!localProd) return null;
      finalProducto = { ...localProd, imagenes: [{ id: 0, url: localProd.imagen, orden: 0 }] };
    } else {
      finalProducto = { ...producto, imagenes: [{ id: 0, url: producto.imagen, orden: 0 }] };
      
      // Intentar obtener imágenes adicionales por separado (por si la relación falla)
      const { data: imgs } = await supabase
        .from('producto_imagenes')
        .select('id, url, orden')
        .eq('producto_id', id)
        .order('orden', { ascending: true });
        
      if (imgs && imgs.length > 0) {
        finalProducto.imagenes = imgs;
      }
    }

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

    if (resError) {
      console.warn("Fallo al obtener reseñas con perfiles, intentando sin join:", resError);
      
      // Fallback: Intentar obtener reseñas sin el join a profiles
      const { data: resenasFallback, error: resErrorFallback } = await supabase
        .from('resenas')
        .select(`
          id,
          puntuacion,
          comentario,
          created_at,
          user_id
        `)
        .eq('producto_id', id)
        .order('created_at', { ascending: false });
        
      if (resErrorFallback) {
        console.error("Error definitivo al obtener reseñas del producto:", resErrorFallback);
        finalResenas = [];
      } else {
        // Extraer los user_ids que existan
        const userIds = resenasFallback.map((r: { user_id: string }) => r.user_id).filter(Boolean);
        const uniqueUserIds = [...new Set(userIds)];
        
        const profilesMap: Record<string, { id: string; username: string; avatar_url: string }> = {};
        
        if (uniqueUserIds.length > 0) {
          // Obtener los perfiles manualmente para evadir el error de relación
          const { data: perfiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', uniqueUserIds);
            
          if (perfiles) {
            perfiles.forEach(p => { profilesMap[p.id] = p; });
          }
        }
        
        finalResenas = (resenasFallback || []).map((r: { id: number; puntuacion: number; comentario: string; created_at: string; user_id: string }) => ({ 
          ...r, 
          profiles: r.user_id && profilesMap[r.user_id] ? profilesMap[r.user_id] : null 
        }));
      }
    } else {
      finalResenas = (resenas || []).map((r: { id: number; puntuacion: number; comentario: string; created_at: string; profiles: unknown }) => ({
        id: r.id,
        puntuacion: r.puntuacion,
        comentario: r.comentario,
        created_at: r.created_at,
        profiles: Array.isArray(r.profiles) ? (r.profiles[0] || null) : (r.profiles || null)
      }));
    }

    return {
      producto: finalProducto,
      resenas: finalResenas as unknown as Array<{ id: number; puntuacion: number; comentario: string; created_at: string; profiles: { username: string; avatar_url: string } | null }>
    };
  }, []);

  return { productos, cargando, fetchProductoById, refetchProductos: fetchProductos };
}