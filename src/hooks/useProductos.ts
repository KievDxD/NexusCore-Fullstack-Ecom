import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Producto, ProductoImagen, Resena, ResenaPerfil } from '../types';
import { LISTA_PRODUCTOS } from '../data/productos';

const CACHE_TTL_MS = 120_000;
const FETCH_TIMEOUT_MS = 8000;

interface ProductosState {
  productos: Producto[];
  cargando: boolean;
  ultimaActualizacion: number;
  fetchProductos: (force?: boolean) => Promise<void>;
  agregarProductoStore: (nuevoProd: Omit<Producto, 'id'>) => Promise<Producto>;
  actualizarProductoStore: (id: number, cambios: Partial<Producto>) => Promise<void>;
  eliminarProductoStore: (id: number) => Promise<void>;
  bulkUpdateStock: (nuevoStock: number) => Promise<void>;
  bulkCategoryDiscount: (categoria: string, descuento: number) => Promise<void>;
}

const toError = (err: unknown): Error => {
  if (err instanceof Error) return err;
  const msg = (err as { message?: unknown } | null)?.message;
  return new Error(typeof msg === 'string' ? msg : String(err), { cause: err });
};

export const useProductosStore = create<ProductosState>((set, get) => ({
  productos: LISTA_PRODUCTOS, // Stale-While-Revalidate: arranca con datos locales
  cargando: false,
  ultimaActualizacion: 0,

  fetchProductos: async (force = false) => {
    const { ultimaActualizacion, cargando } = get();

    // Evitamos peticiones concurrentes o re-fetch dentro del TTL, salvo que sea forzado
    if (cargando || (!force && Date.now() - ultimaActualizacion < CACHE_TTL_MS)) return;

    set({ cargando: true });

    // AbortController real: cancela la petición (antes Promise.race la dejaba viva)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true })
        .abortSignal(controller.signal);

      if (error || !data || data.length === 0) {
        console.warn('Manteniendo catálogo local (fallback) por error, timeout o base de datos vacía');
        return;
      }

      set({ productos: data as Producto[], ultimaActualizacion: Date.now() });
    } catch (err) {
      console.error('Error inesperado en fetch de productos, manteniendo fallback local:', err);
    } finally {
      clearTimeout(timer);
      // Siempre se libera el flag, incluso en timeout (antes quedaba atascado en true)
      set({ cargando: false });
    }
  },

  agregarProductoStore: async (nuevoProd) => {
    try {
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
          stock: nuevoProd.stock,
          descuento: nuevoProd.descuento ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se pudo crear el producto en la base de datos.');

      let finalImgs: ProductoImagen[] = [];

      if (nuevoProd.imagenes && nuevoProd.imagenes.length > 0) {
        const rowsToInsert = nuevoProd.imagenes.map((img, idx) => ({
          producto_id: data.id,
          url: img.url,
          orden: img.orden ?? idx,
        }));

        const { data: insertedImgs, error: imgError } = await supabase
          .from('producto_imagenes')
          .insert(rowsToInsert)
          .select('id, url, orden');

        if (imgError) {
          console.warn('Fallo al guardar imágenes adicionales:', imgError.message);
        } else if (insertedImgs) {
          finalImgs = insertedImgs as ProductoImagen[];
        }
      }

      const productoCompleto: Producto = { ...(data as Producto), imagenes: finalImgs };
      set((state) => ({ productos: [...state.productos, productoCompleto] }));
      return productoCompleto;
    } catch (err) {
      console.error('Error en agregarProductoStore:', err);
      throw toError(err);
    }
  },

  actualizarProductoStore: async (id, cambios) => {
    try {
      const { imagenes, ...cambiosBase } = cambios;

      if (Object.keys(cambiosBase).length > 0) {
        const { error } = await supabase.from('productos').update(cambiosBase).eq('id', id);
        if (error) throw error;
      }

      let imagenesFinales: ProductoImagen[] | undefined;

      if (imagenes !== undefined) {
        // Reemplazo seguro: primero se insertan las nuevas y SOLO si funciona se borran las viejas.
        // Así un fallo a mitad de camino nunca deja el producto sin imágenes.
        const { data: previas, error: prevError } = await supabase
          .from('producto_imagenes')
          .select('id')
          .eq('producto_id', id);
        if (prevError) throw prevError;
        const idsPrevios = (previas ?? []).map((r) => r.id as number);

        if (imagenes.length > 0) {
          const rowsToInsert = imagenes.map((img, idx) => ({
            producto_id: id,
            url: img.url,
            orden: img.orden ?? idx,
          }));
          const { data: nuevas, error: insError } = await supabase
            .from('producto_imagenes')
            .insert(rowsToInsert)
            .select('id, url, orden');
          if (insError) throw insError;
          imagenesFinales = (nuevas ?? []) as ProductoImagen[];
        } else {
          imagenesFinales = [];
        }

        if (idsPrevios.length > 0) {
          const { error: delError } = await supabase
            .from('producto_imagenes')
            .delete()
            .in('id', idsPrevios);
          if (delError) console.warn('Fallo al borrar imágenes antiguas:', delError.message);
        }
      }

      set((state) => ({
        productos: state.productos.map((p) =>
          p.id === id
            ? { ...p, ...cambiosBase, ...(imagenesFinales !== undefined ? { imagenes: imagenesFinales } : {}) }
            : p
        ),
      }));
    } catch (err) {
      console.error('Error en actualizarProductoStore:', err);
      throw toError(err);
    }
  },

  eliminarProductoStore: async (id) => {
    try {
      // ON DELETE CASCADE limpia producto_imagenes y resenas
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      set((state) => ({ productos: state.productos.filter((p) => p.id !== id) }));
    } catch (err) {
      console.error('Error en eliminarProductoStore:', err);
      throw toError(err);
    }
  },

  bulkUpdateStock: async (nuevoStock) => {
    try {
      const { error } = await supabase.from('productos').update({ stock: nuevoStock }).gte('id', 0);
      if (error) throw error;
      set((state) => ({ productos: state.productos.map((p) => ({ ...p, stock: nuevoStock })) }));
    } catch (err) {
      console.error('Error en bulkUpdateStock:', err);
      throw toError(err);
    }
  },

  bulkCategoryDiscount: async (categoria, descuento) => {
    try {
      const { error } = await supabase.from('productos').update({ descuento }).eq('categoria', categoria);
      if (error) throw error;
      set((state) => ({
        productos: state.productos.map((p) => (p.categoria === categoria ? { ...p, descuento } : p)),
      }));
    } catch (err) {
      console.error('Error en bulkCategoryDiscount:', err);
      throw toError(err);
    }
  },
}));

// ───────────────────────── Detalle de producto (fuera del hook: función pura y estable)

const DB_TIMEOUT_MS = 2500;

type ResenaRow = {
  id: number;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
  user_id?: string | null;
  profiles?: ResenaPerfil | ResenaPerfil[] | null;
};

const normalizarResena = (r: ResenaRow, perfil: ResenaPerfil | null): Resena => ({
  id: r.id,
  puntuacion: r.puntuacion,
  comentario: r.comentario ?? '',
  created_at: r.created_at,
  profiles: perfil,
});

const conImagenLocal = (p: Producto): Producto => ({
  ...p,
  imagenes: [{ id: 0, url: p.imagen, orden: 0 }],
});

async function resenasSinJoin(id: number, signal: AbortSignal): Promise<Resena[]> {
  const { data } = await supabase
    .from('resenas')
    .select('id, puntuacion, comentario, created_at, user_id')
    .eq('producto_id', id)
    .order('created_at', { ascending: false })
    .abortSignal(signal);

  const rows = (data ?? []) as ResenaRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((u): u is string => Boolean(u)))];
  const perfiles = new Map<string, ResenaPerfil>();
  if (userIds.length > 0) {
    const { data: ps } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)
      .abortSignal(signal);
    (ps ?? []).forEach((p) => perfiles.set(p.id as string, p as ResenaPerfil));
  }

  return rows.map((r) => normalizarResena(r, (r.user_id && perfiles.get(r.user_id)) || null));
}

export async function fetchProductoDetalle(id: number): Promise<{ producto: Producto | null; resenas: Resena[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  const localProd = LISTA_PRODUCTOS.find((p) => p.id === id);
  const fallback = localProd ? conImagenLocal(localProd) : null;

  try {
    const [prodResult, imgsResult, resenasResult] = await Promise.all([
      supabase.from('productos').select('*').eq('id', id).abortSignal(controller.signal).maybeSingle(),
      supabase
        .from('producto_imagenes')
        .select('id, url, orden')
        .eq('producto_id', id)
        .order('orden', { ascending: true })
        .abortSignal(controller.signal),
      supabase
        .from('resenas')
        .select('id, puntuacion, comentario, created_at, user_id, profiles(username, avatar_url)')
        .eq('producto_id', id)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal),
    ]);

    let producto: Producto | null;
    if (prodResult.error || !prodResult.data) {
      console.warn(`Producto #${id} no encontrado en Supabase o error:`, prodResult.error);
      producto = fallback;
    } else {
      const base = prodResult.data as Producto;
      const imgs = (imgsResult.data ?? []) as ProductoImagen[];
      producto = { ...base, imagenes: imgs.length > 0 ? imgs : [{ id: 0, url: base.imagen, orden: 0 }] };
    }

    let resenas: Resena[] = [];
    if (resenasResult.error) {
      console.warn('Fallo al obtener reseñas con perfiles, intentando sin join:', resenasResult.error);
      try {
        resenas = await resenasSinJoin(id, controller.signal);
      } catch (e) {
        console.error('Error definitivo al cargar reseñas fallback:', e);
      }
    } else {
      resenas = ((resenasResult.data ?? []) as unknown as ResenaRow[]).map((r) =>
        normalizarResena(r, Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : (r.profiles ?? null))
      );
    }

    return { producto, resenas };
  } catch (err) {
    console.warn(`Timeout/error al obtener producto #${id} desde Supabase. Usando catálogo local.`, err);
    return { producto: fallback, resenas: [] };
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────── Hook público (misma API que antes, pero con selectores)

export function useProductos() {
  const productos = useProductosStore((s) => s.productos);
  const cargando = useProductosStore((s) => s.cargando);
  const fetchProductos = useProductosStore((s) => s.fetchProductos);
  const agregarProductoStore = useProductosStore((s) => s.agregarProductoStore);
  const actualizarProductoStore = useProductosStore((s) => s.actualizarProductoStore);
  const eliminarProductoStore = useProductosStore((s) => s.eliminarProductoStore);
  const bulkUpdateStock = useProductosStore((s) => s.bulkUpdateStock);
  const bulkCategoryDiscount = useProductosStore((s) => s.bulkCategoryDiscount);

  useEffect(() => {
    // Respeta el TTL del store: no genera tráfico si la caché está fresca
    void fetchProductos();
  }, [fetchProductos]);

  const refetchProductos = useCallback(() => fetchProductos(true), [fetchProductos]);

  return {
    productos,
    cargando,
    fetchProductoById: fetchProductoDetalle,
    refetchProductos,
    agregarProductoStore,
    actualizarProductoStore,
    eliminarProductoStore,
    bulkUpdateStock,
    bulkCategoryDiscount,
  };
}
