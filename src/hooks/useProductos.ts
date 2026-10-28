import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Producto, ProductoImagen, Resena, ResenaPerfil } from '../types';
import { LISTA_PRODUCTOS } from '../data/productos';

const CACHE_TTL_MS = 120_000;
const FETCH_TIMEOUT_MS = 8000;
const CATALOG_PAGE_SIZE = 100;
const CATALOG_STORAGE_KEY = 'nexus_catalog_cache_v2';

// Selección explícita de columnas para el listado del catálogo
const PRODUCTO_CATALOG_COLUMNS =
  'id, nombre, precio, imagen, categoria, descripcion, descripcion_larga, especificaciones, marca, stock, descuento';

function loadCachedCatalog(): Producto[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as Producto[];
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedCatalog(productos: Producto[]) {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(productos));
  } catch {
    // ignore storage errors
  }
}

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

// Deduplicación de peticiones en vuelo + caché de detalle por ID (evita waterfalls y doble fetch en StrictMode)
const detalleCache = new Map<number, { data: { producto: Producto | null; resenas: Resena[] }; timestamp: number }>();
const detalleInflight = new Map<number, Promise<{ producto: Producto | null; resenas: Resena[] }>>();
const DETALLE_CACHE_TTL_MS = 60_000;

export function invalidateProductoDetalleCache(id?: number) {
  if (id !== undefined) {
    detalleCache.delete(id);
  } else {
    detalleCache.clear();
  }
}

const initialCachedCatalog = loadCachedCatalog();

export const useProductosStore = create<ProductosState>((set, get) => ({
  // Nunca iniciar con LISTA_PRODUCTOS de prueba para evitar mostrar imágenes irrelevantes antes de cargar la BD real
  productos: initialCachedCatalog ?? [],
  cargando: initialCachedCatalog === null,
  ultimaActualizacion: 0,

  fetchProductos: async (force = false) => {
    const { ultimaActualizacion, cargando, productos } = get();

    // Evitamos peticiones concurrentes o re-fetch dentro del TTL, salvo que sea forzado
    if ((cargando && ultimaActualizacion > 0) || (!force && ultimaActualizacion > 0 && Date.now() - ultimaActualizacion < CACHE_TTL_MS)) {
      return;
    }

    if (productos.length === 0) {
      set({ cargando: true });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const { data, error } = await supabase
        .from('productos')
        .select(PRODUCTO_CATALOG_COLUMNS)
        .order('id', { ascending: true })
        .range(0, CATALOG_PAGE_SIZE - 1)
        .abortSignal(controller.signal);

      if (error || !data || data.length === 0) {
        if (get().productos.length === 0) {
          set({ productos: LISTA_PRODUCTOS, ultimaActualizacion: Date.now() });
        }
        return;
      }

      const listaReal = data as Producto[];
      saveCachedCatalog(listaReal);
      set({ productos: listaReal, ultimaActualizacion: Date.now() });
    } catch (err) {
      console.error('Error inesperado en fetch de productos:', err);
      if (get().productos.length === 0) {
        set({ productos: LISTA_PRODUCTOS });
      }
    } finally {
      clearTimeout(timer);
      set({ cargando: false });
    }
  },

  agregarProductoStore: async (nuevoProd) => {
    try {
      // 1. Intentar mediante RPC transaccional en un solo round-trip
      const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_producto_con_imagenes', {
        p_id: null,
        p_nombre: nuevoProd.nombre,
        p_precio: nuevoProd.precio,
        p_imagen: nuevoProd.imagen,
        p_categoria: nuevoProd.categoria,
        p_descripcion: nuevoProd.descripcion,
        p_descripcion_larga: nuevoProd.descripcion_larga ?? null,
        p_especificaciones: nuevoProd.especificaciones ?? null,
        p_marca: nuevoProd.marca ?? null,
        p_stock: nuevoProd.stock ?? 10,
        p_descuento: nuevoProd.descuento ?? 0,
        p_imagenes: nuevoProd.imagenes ?? [],
      });

      if (!rpcError && rpcData) {
        const productoCompleto = rpcData as unknown as Producto;
        set((state) => {
          const next = [...state.productos, productoCompleto];
          saveCachedCatalog(next);
          return { productos: next };
        });
        return productoCompleto;
      }

      // 2. Fallback directo si la migración RPC aún no ha sido ejecutada en la instancia remota
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
        .select(PRODUCTO_CATALOG_COLUMNS)
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
      set((state) => {
        const next = [...state.productos, productoCompleto];
        saveCachedCatalog(next);
        return { productos: next };
      });
      return productoCompleto;
    } catch (err) {
      console.error('Error en agregarProductoStore:', err);
      throw toError(err);
    }
  },

  actualizarProductoStore: async (id, cambios) => {
    try {
      const actual = get().productos.find((p) => p.id === id);
      const { imagenes, ...cambiosBase } = cambios;

      // 1. Intentar mediante RPC transaccional en un solo round-trip
      if (actual) {
        const merged = { ...actual, ...cambiosBase };
        const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_producto_con_imagenes', {
          p_id: id,
          p_nombre: merged.nombre,
          p_precio: merged.precio,
          p_imagen: merged.imagen,
          p_categoria: merged.categoria,
          p_descripcion: merged.descripcion,
          p_descripcion_larga: merged.descripcion_larga ?? null,
          p_especificaciones: merged.especificaciones ?? null,
          p_marca: merged.marca ?? null,
          p_stock: merged.stock ?? 10,
          p_descuento: merged.descuento ?? 0,
          p_imagenes: imagenes !== undefined ? imagenes : null,
        });

        if (!rpcError && rpcData) {
          const actualizado = rpcData as unknown as Producto;
          invalidateProductoDetalleCache(id);
          set((state) => {
            const next = state.productos.map((p) => (p.id === id ? actualizado : p));
            saveCachedCatalog(next);
            return { productos: next };
          });
          return;
        }
      }

      // 2. Fallback secuencial si la RPC no está disponible
      if (Object.keys(cambiosBase).length > 0) {
        const { error } = await supabase.from('productos').update(cambiosBase).eq('id', id);
        if (error) throw error;
      }

      let imagenesFinales: ProductoImagen[] | undefined;

      if (imagenes !== undefined) {
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

      invalidateProductoDetalleCache(id);
      set((state) => {
        const next = state.productos.map((p) =>
          p.id === id
            ? { ...p, ...cambiosBase, ...(imagenesFinales !== undefined ? { imagenes: imagenesFinales } : {}) }
            : p
        );
        saveCachedCatalog(next);
        return { productos: next };
      });
    } catch (err) {
      console.error('Error en actualizarProductoStore:', err);
      throw toError(err);
    }
  },

  eliminarProductoStore: async (id) => {
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      invalidateProductoDetalleCache(id);
      set((state) => {
        const next = state.productos.filter((p) => p.id !== id);
        saveCachedCatalog(next);
        return { productos: next };
      });
    } catch (err) {
      console.error('Error en eliminarProductoStore:', err);
      throw toError(err);
    }
  },

  bulkUpdateStock: async (nuevoStock) => {
    try {
      const { error } = await supabase.from('productos').update({ stock: nuevoStock }).gte('id', 0);
      if (error) throw error;
      invalidateProductoDetalleCache();
      set((state) => {
        const next = state.productos.map((p) => ({ ...p, stock: nuevoStock }));
        saveCachedCatalog(next);
        return { productos: next };
      });
    } catch (err) {
      console.error('Error en bulkUpdateStock:', err);
      throw toError(err);
    }
  },

  bulkCategoryDiscount: async (categoria, descuento) => {
    try {
      const { error } = await supabase.from('productos').update({ descuento }).eq('categoria', categoria);
      if (error) throw error;
      invalidateProductoDetalleCache();
      set((state) => {
        const next = state.productos.map((p) => (p.categoria === categoria ? { ...p, descuento } : p));
        saveCachedCatalog(next);
        return { productos: next };
      });
    } catch (err) {
      console.error('Error en bulkCategoryDiscount:', err);
      throw toError(err);
    }
  },
}));

// ───────────────────────── Detalle de producto (con caché en memoria, deduplicación y RPC unificada)

const DB_TIMEOUT_MS = 3000;
const RESENAS_PAGE_SIZE = 50;

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

// Garantiza que la imagen principal del producto sea SIEMPRE la primera y no sea desplazada por imágenes antiguas de galería
const normalizarGaleriaProducto = (imagenPrincipal: string, galeria?: ProductoImagen[] | null): ProductoImagen[] => {
  const resultado: ProductoImagen[] = [];
  const principal = (imagenPrincipal || '').trim();
  if (principal) {
    resultado.push({ id: 0, url: principal, orden: 0 });
  }
  (galeria ?? []).forEach((img, idx) => {
    const url = (img?.url || '').trim();
    if (url && !resultado.some((item) => item.url === url)) {
      resultado.push({ id: img.id ?? idx + 1, url, orden: resultado.length });
    }
  });
  return resultado;
};

const conImagenLocal = (p: Producto): Producto => ({
  ...p,
  imagenes: normalizarGaleriaProducto(p.imagen, p.imagenes),
});

async function resenasSinJoin(id: number, signal: AbortSignal): Promise<Resena[]> {
  const { data } = await supabase
    .from('resenas')
    .select('id, puntuacion, comentario, created_at, user_id')
    .eq('producto_id', id)
    .order('created_at', { ascending: false })
    .range(0, RESENAS_PAGE_SIZE - 1)
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

export async function fetchProductoDetalle(
  id: number,
  force = false
): Promise<{ producto: Producto | null; resenas: Resena[] }> {
  const now = Date.now();
  if (!force) {
    const cached = detalleCache.get(id);
    if (cached && now - cached.timestamp < DETALLE_CACHE_TTL_MS) {
      return cached.data;
    }
    const inflight = detalleInflight.get(id);
    if (inflight) return inflight;
  }

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
    const storeProd = useProductosStore.getState().productos.find((p) => p.id === id);
    const localProd = storeProd ?? LISTA_PRODUCTOS.find((p) => p.id === id);
    const fallback = localProd ? conImagenLocal(localProd) : null;

    try {
      // 1. Intentar RPC unificada (1 solo viaje de red para producto + imágenes + reseñas)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_producto_detalle', { p_id: id })
        .abortSignal(controller.signal);

      if (!rpcError && rpcData) {
        const parsed = rpcData as { producto: Producto; resenas: Resena[] };
        const base = parsed.producto;
        const imgs = normalizarGaleriaProducto(base.imagen, base.imagenes);
        const result = {
          producto: { ...base, imagenes: imgs },
          resenas: parsed.resenas ?? [],
        };
        detalleCache.set(id, { data: result, timestamp: Date.now() });
        return result;
      }

      // 2. Fallback paralelo con selección explícita y paginación
      const [prodResult, imgsResult, resenasResult] = await Promise.all([
        supabase
          .from('productos')
          .select(PRODUCTO_CATALOG_COLUMNS)
          .eq('id', id)
          .abortSignal(controller.signal)
          .maybeSingle(),
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
          .range(0, RESENAS_PAGE_SIZE - 1)
          .abortSignal(controller.signal),
      ]);

      let producto: Producto | null;
      if (prodResult.error || !prodResult.data) {
        producto = fallback;
      } else {
        const base = prodResult.data as Producto;
        const imgs = (imgsResult.data ?? []) as ProductoImagen[];
        producto = { ...base, imagenes: normalizarGaleriaProducto(base.imagen, imgs) };
      }

      let resenas: Resena[] = [];
      if (resenasResult.error) {
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

      const result = { producto, resenas };
      if (producto) {
        detalleCache.set(id, { data: result, timestamp: Date.now() });
      }
      return result;
    } catch (err) {
      console.warn(`Timeout/error al obtener producto #${id} desde Supabase. Usando catálogo local.`, err);
      return { producto: fallback, resenas: [] };
    } finally {
      clearTimeout(timer);
      detalleInflight.delete(id);
    }
  })();

  detalleInflight.set(id, promise);
  return promise;
}

// ───────────────────────── Hook público

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
