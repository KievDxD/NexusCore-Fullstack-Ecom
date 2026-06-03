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
  agregarProductoStore: (nuevoProd: Omit<Producto, 'id'>) => Promise<Producto>;
  actualizarProductoStore: (id: number, cambios: Partial<Producto>) => Promise<void>;
  eliminarProductoStore: (id: number) => Promise<void>;
  bulkUpdateStock: (nuevoStock: number) => Promise<void>;
  bulkCategoryDiscount: (categoria: string, descuento: number) => Promise<void>;
}

export const useProductosStore = create<ProductosState>((set, get) => ({
  productos: LISTA_PRODUCTOS, // <-- Stale-While-Revalidate: Inicializamos con datos locales instantáneamente
  cargando: false, // <-- No bloqueamos la UI inicial
  yaIntento: false,
  fetchProductos: async () => {
    if (get().yaIntento) return;
    set({ yaIntento: true }); // Marcamos intento pero no bloqueamos con cargando: true

    // Damos más tiempo a Supabase para despertar (cold start del free tier)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));

    try {
      const fetchPromise = supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true });

      const result = await Promise.race([fetchPromise, timeout]);

      if (!result || 'error' in result === false) {
        console.warn("Timeout de conexion con Supabase, manteniendo catalogo local");
        return; // Mantenemos LISTA_PRODUCTOS que ya está en el estado
      }

      const { data, error } = result as { data: Producto[] | null; error: unknown };

      if (error || !data || data.length === 0) {
        console.warn("Mantenemos catalogo local (fallback) debido a error o base de datos vacia");
      } else {
        // Solo actualizamos si Supabase tiene datos reales
        set({ productos: data });
      }
    } catch (err) {
      console.error("Error inesperado en fetch de productos, manteniendo fallback local:", err);
    }
  },

  agregarProductoStore: async (nuevoProd) => {
    try {
      // 1. Insertar el producto base en Supabase
      const { data, error } = await supabase
        .from('productos')
        .insert({
          nombre: nuevoProd.nombre,
          precio: nuevoProd.precio,
          imagen: nuevoProd.imagen,
          categoria: nuevoProd.categoria,
          descripcion: nuevoProd.descripcion,
          descripcion_larga: nuevoProd.descripcion_larga,
          especificaciones: nuevoProd.especificaciones,
          marca: nuevoProd.marca,
          stock: nuevoProd.stock
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("No se pudo crear el producto en la base de datos.");

      const creadorId = data.id;
      let finalImgs: { id: number; url: string; orden: number }[] = [];

      // 2. Si tiene imágenes adicionales, insertarlas
      if (nuevoProd.imagenes && nuevoProd.imagenes.length > 0) {
        const rowsToInsert = nuevoProd.imagenes.map((img, idx) => ({
          producto_id: creadorId,
          url: img.url,
          orden: img.orden ?? idx
        }));

        const { data: insertedImgs, error: imgError } = await supabase
          .from('producto_imagenes')
          .insert(rowsToInsert)
          .select('id, url, orden');

        if (imgError) {
          console.warn("Fallo al guardar imágenes adicionales:", imgError.message);
        } else if (insertedImgs) {
          finalImgs = insertedImgs;
        }
      }

      const productoCompleto: Producto = { ...data, imagenes: finalImgs };

      // 3. Agregar al estado de Zustand
      set((state) => ({
        productos: [...state.productos, productoCompleto]
      }));

      return productoCompleto;
    } catch (err) {
      console.error("Error en agregarProductoStore:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  },

  actualizarProductoStore: async (id, cambios) => {
    try {
      const { imagenes, ...cambiosBase } = cambios;

      // 1. Actualizar campos base de productos en Supabase
      if (Object.keys(cambiosBase).length > 0) {
        const { error } = await supabase
          .from('productos')
          .update(cambiosBase)
          .eq('id', id);

        if (error) throw error;
      }

      // 2. Si se pasaron imágenes adicionales, reemplazarlas
      if (imagenes !== undefined) {
        const { error: delError } = await supabase
          .from('producto_imagenes')
          .delete()
          .eq('producto_id', id);

        if (delError) console.warn("Fallo al borrar imágenes adicionales antiguas:", delError.message);

        if (imagenes.length > 0) {
          const rowsToInsert = imagenes.map((img, idx) => ({
            producto_id: id,
            url: img.url,
            orden: img.orden ?? idx
          }));

          const { error: insError } = await supabase
            .from('producto_imagenes')
            .insert(rowsToInsert);

          if (insError) console.warn("Fallo al insertar nuevas imágenes adicionales:", insError.message);
        }
      }

      // 3. Sincronizar en el estado de Zustand
      set((state) => ({
        productos: state.productos.map((p) =>
          p.id === id
            ? { ...p, ...cambiosBase, ...(imagenes !== undefined ? { imagenes } : {}) }
            : p
        )
      }));
    } catch (err) {
      console.error("Error en actualizarProductoStore:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  },

  eliminarProductoStore: async (id) => {
    try {
      // 1. Borrar en la base de datos (Supabase tiene ON DELETE CASCADE en producto_imagenes y resenas)
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // 2. Borrar del estado de Zustand
      set((state) => ({
        productos: state.productos.filter((p) => p.id !== id)
      }));
    } catch (err) {
      console.error("Error en eliminarProductoStore:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  },

  bulkUpdateStock: async (nuevoStock: number) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ stock: nuevoStock })
        .gte('id', 0); // Todas las filas

      if (error) throw error;

      set((state) => ({
        productos: state.productos.map(p => ({ ...p, stock: nuevoStock }))
      }));
    } catch (err) {
      console.error("Error en bulkUpdateStock:", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  },

  bulkCategoryDiscount: async (categoria: string, descuento: number) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ descuento })
        .eq('categoria', categoria);

      if (error) throw error;

      set((state) => ({
        productos: state.productos.map(p =>
          p.categoria === categoria ? { ...p, descuento } : p
        )
      }));
    } catch (err) {
      console.error("Error en bulkCategoryDiscount:", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}));
export function useProductos() {
  const { 
    productos, 
    cargando, 
    fetchProductos,
    agregarProductoStore,
    actualizarProductoStore,
    eliminarProductoStore,
    bulkUpdateStock,
    bulkCategoryDiscount
  } = useProductosStore();

  useEffect(() => {
    if (!useProductosStore.getState().yaIntento) {
      fetchProductos();
    }
  }, [fetchProductos]);

  const fetchProductoById = useCallback(async (id: number) => {
    // Definir un timeout de 2.5 segundos para la consulta de base de datos
    const dbTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));

    const fetchDataPromise = (async () => {
      try {
        // Ejecutar consultas en paralelo para máxima velocidad
        const [prodResult, imgsResult, resenasResult] = await Promise.all([
          supabase.from('productos').select('*').eq('id', id).maybeSingle(),
          supabase.from('producto_imagenes').select('id, url, orden').eq('producto_id', id).order('orden', { ascending: true }),
          supabase.from('resenas').select(`
            id,
            puntuacion,
            comentario,
            created_at,
            user_id,
            profiles(username, avatar_url)
          `).eq('producto_id', id).order('created_at', { ascending: false })
        ]);

        return { prodResult, imgsResult, resenasResult };
      } catch (err) {
        console.error("Error al consultar Supabase en paralelo:", err);
        return null;
      }
    })();

    const result = await Promise.race([fetchDataPromise, dbTimeout]);

    let finalProducto: Producto | null = null;
    let finalResenas: any[] = [];
    const localProd = LISTA_PRODUCTOS.find(p => p.id === id);

    if (!result) {
      // Si hay timeout o error en red
      console.warn(`Timeout al obtener producto #${id} desde Supabase. Usando catálogo local.`);
      if (localProd) {
        finalProducto = { ...localProd, imagenes: [{ id: 0, url: localProd.imagen, orden: 0 }] };
      }
    } else {
      const { prodResult, imgsResult, resenasResult } = result;

      // 1. Procesar Producto
      if (prodResult?.error || !prodResult?.data) {
        console.warn(`Producto #${id} no encontrado en Supabase o error:`, prodResult?.error);
        if (localProd) {
          finalProducto = { ...localProd, imagenes: [{ id: 0, url: localProd.imagen, orden: 0 }] };
        }
      } else {
        finalProducto = { 
          ...prodResult.data, 
          imagenes: (imgsResult?.data && imgsResult.data.length > 0) ? imgsResult.data : [{ id: 0, url: prodResult.data.imagen, orden: 0 }] 
        };
      }

      // 2. Procesar Reseñas
      if (resenasResult?.error) {
        console.warn("Fallo al obtener reseñas con perfiles, intentando sin join:", resenasResult.error);
        // Fallback: intentar obtener reseñas sin join
        try {
          const { data: resenasFallback } = await supabase
            .from('resenas')
            .select('id, puntuacion, comentario, created_at, user_id')
            .eq('producto_id', id)
            .order('created_at', { ascending: false });

          if (resenasFallback && resenasFallback.length > 0) {
            const userIds = resenasFallback.map(r => r.user_id).filter(Boolean);
            const uniqueUserIds = [...new Set(userIds)];
            const profilesMap: Record<string, any> = {};

            if (uniqueUserIds.length > 0) {
              const { data: perfiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', uniqueUserIds);
              if (perfiles) {
                perfiles.forEach(p => { profilesMap[p.id] = p; });
              }
            }

            finalResenas = resenasFallback.map(r => ({
              id: r.id,
              puntuacion: r.puntuacion,
              comentario: r.comentario,
              created_at: r.created_at,
              profiles: r.user_id && profilesMap[r.user_id] ? profilesMap[r.user_id] : null
            }));
          }
        } catch (fallbackErr) {
          console.error("Error definitivo al cargar reseñas fallback:", fallbackErr);
        }
      } else if (resenasResult?.data) {
        finalResenas = resenasResult.data.map((r: any) => ({
          id: r.id,
          puntuacion: r.puntuacion,
          comentario: r.comentario,
          created_at: r.created_at,
          profiles: Array.isArray(r.profiles) ? (r.profiles[0] || null) : (r.profiles || null)
        }));
      }
    }

    return {
      producto: finalProducto,
      resenas: finalResenas
    };
  }, []);

  return { 
    productos, 
    cargando, 
    fetchProductoById, 
    refetchProductos: fetchProductos,
    agregarProductoStore,
    actualizarProductoStore,
    eliminarProductoStore,
    bulkUpdateStock,
    bulkCategoryDiscount
  };
}