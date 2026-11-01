import { useState, useMemo, useDeferredValue, useCallback, lazy, Suspense, useRef } from 'react';
import TarjetaProducto from '../components/TarjetaProducto';
import { useProductos } from '../hooks/useProductos';
import { Loader2, Plus, Scale, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useComparadorStore, obtenerTipoProducto, CATEGORIAS_PRODUCTO } from '../hooks/useComparador';
import type { Producto } from '../types';

// Un solo modal de administración (antes había uno por tarjeta) y solo se descarga si eres admin
const AdminProductoModal = lazy(() => import('../components/AdminProductoModal'));

export default function Home() {
  const [busqueda, setBusqueda] = useState('');
  const [grupoActivo, setGrupoActivo] = useState<'Todos' | 'Componentes' | 'Periféricos'>('Todos');
  const [tipoActivo, setTipoActivo] = useState<string>('todos');
  const [soloEnStock, setSoloEnStock] = useState(false);
  
  // 🆕 Usamos nuestro hook premium con soporte de fallback local y control de stock
  const { productos: productosDB, cargando } = useProductos();
  const { isAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);

  // Estado del comparador para aislar la categoría activa de comparación
  const comparadorItems = useComparadorStore((s) => s.items);
  const limpiarComparador = useComparadorStore((s) => s.limpiarComparador);
  const tipoComparando = useMemo(
    () => (comparadorItems.length > 0 ? obtenerTipoProducto(comparadorItems[0]) : null),
    [comparadorItems]
  );

  const subcategoriasDisponibles = useMemo(() => {
    if (grupoActivo === 'Todos') return CATEGORIAS_PRODUCTO;
    return CATEGORIAS_PRODUCTO.filter((c) => c.grupo === grupoActivo);
  }, [grupoActivo]);

  const subcategoriasRef = useRef<HTMLDivElement>(null);

  const scrollSubcategorias = (direccion: 'izq' | 'der') => {
    if (subcategoriasRef.current) {
      const scrollAmount = 260;
      subcategoriasRef.current.scrollBy({
        left: direccion === 'izq' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const abrirNuevo = useCallback(() => {
    setProductoEnEdicion(null);
    setModalOpen(true);
  }, []);
  const abrirEdicion = useCallback((p: Producto) => {
    setProductoEnEdicion(p);
    setModalOpen(true);
  }, []);
  const cerrarModal = useCallback(() => setModalOpen(false), []);

  // La búsqueda se difiere para no bloquear la escritura con catálogos grandes
  const busquedaDiferida = useDeferredValue(busqueda);

  // Al comparar o filtrar por categoría específica, aislar y solo dejar los elementos del mismo tipo
  const productosFiltrados = useMemo(() => {
    const q = busquedaDiferida.trim().toLowerCase();
    const filtrados = productosDB.filter((producto) => {
      const tipo = obtenerTipoProducto(producto);

      if (tipoComparando) {
        if (tipo.id !== tipoComparando.id) return false;
      } else {
        if (grupoActivo !== 'Todos' && tipo.grupo !== grupoActivo) {
          return false;
        }
        if (tipoActivo !== 'todos' && tipo.id !== tipoActivo) {
          return false;
        }
      }

      if (soloEnStock && (producto.stock ?? 10) <= 0) {
        return false;
      }

      const coincideBusqueda =
        q === '' ||
        producto.nombre.toLowerCase().includes(q) ||
        producto.descripcion.toLowerCase().includes(q) ||
        (producto.marca && producto.marca.toLowerCase().includes(q));

      return coincideBusqueda;
    });

    // Los productos sin stock se van al final (sort estable: el resto conserva su orden)
    return filtrados.sort((a, b) => Number((a.stock ?? 10) === 0) - Number((b.stock ?? 10) === 0));
  }, [productosDB, busquedaDiferida, grupoActivo, tipoActivo, tipoComparando, soloEnStock]);

  return (
    <div id="catalogo" className="space-y-6 animate-fade-in">
      
      {/* 🛠️ BARRA DE FILTROS Y BUSCADOR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-themeCard p-4 rounded-xl shadow-sm border border-themeBorder text-themeText transition-all duration-500">
        
        {/* Buscador de texto */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar hardware o periférico..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 text-sm bg-themeInput border border-themeBorder rounded-xl focus:outline-none focus:ring-2 focus:ring-themeAccent focus:bg-themeCard transition-all text-themeText placeholder-themeTextMuted/50"
          />
          {busqueda && (
            <button 
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-themeTextMuted hover:text-themeText text-xs font-bold"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Botones de Grupo */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(['Todos', 'Componentes', 'Periféricos'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setGrupoActivo(cat);
                setTipoActivo('todos');
              }}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                grupoActivo === cat
                  ? 'bg-themeAccent text-white shadow-md shadow-themeAccent/15'
                  : 'bg-themeInput text-themeTextMuted hover:bg-themeBorder hover:text-themeText'
              }`}
            >
              {cat}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={abrirNuevo}
              className="px-4 py-2 text-xs md:text-sm font-black rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/15 flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer ml-2"
            >
              <Plus size={14} />
              Agregar Hardware
            </button>
          )}
        </div>
      </div>

      {/* 🏷️ CHIPS DE CATEGORÍAS ESPECÍFICAS CON BARRA DE DESPLAZAMIENTO Y NAVEGACIÓN */}
      {!tipoComparando && (
        <div className="flex items-center gap-2 bg-themeCard/60 border border-themeBorder/70 p-2 rounded-2xl shadow-sm">
          {/* Botón Scroll Izquierda */}
          <button
            type="button"
            onClick={() => scrollSubcategorias('izq')}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl bg-themeInput/80 hover:bg-themeBorder text-themeTextMuted hover:text-themeText transition-all shrink-0 active:scale-95 shadow-xs"
            title="Desplazar categorías a la izquierda"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Contenedor scrolleable con scrollbar visible y wheel horizontal */}
          <div
            ref={subcategoriasRef}
            onWheel={(e) => {
              if (e.deltaY !== 0 && subcategoriasRef.current) {
                subcategoriasRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex-1 flex items-center gap-2 overflow-x-auto pb-2 pt-1 custom-h-scrollbar scroll-smooth"
          >
            <button
              type="button"
              onClick={() => setTipoActivo('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 ${
                tipoActivo === 'todos'
                  ? 'bg-themeAccent text-white shadow-sm shadow-themeAccent/25'
                  : 'bg-themeCard/80 hover:bg-themeCard text-themeTextMuted hover:text-themeText border border-themeBorder/60'
              }`}
            >
              Todos ({grupoActivo})
            </button>
            {subcategoriasDisponibles.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setTipoActivo(sub.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 flex items-center gap-1.5 ${
                  tipoActivo === sub.id
                    ? 'bg-themeAccent text-white shadow-sm shadow-themeAccent/25 border-transparent'
                    : 'bg-themeCard/80 hover:bg-themeCard text-themeTextMuted hover:text-themeText border border-themeBorder/60'
                }`}
              >
                <span>{sub.label}</span>
              </button>
            ))}
          </div>

          {/* Botón Scroll Derecha */}
          <button
            type="button"
            onClick={() => scrollSubcategorias('der')}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl bg-themeInput/80 hover:bg-themeBorder text-themeTextMuted hover:text-themeText transition-all shrink-0 active:scale-95 shadow-xs"
            title="Desplazar categorías a la derecha"
          >
            <ChevronRight size={16} />
          </button>

          {/* Separador vertical */}
          <div className="h-6 w-px bg-themeBorder/70 shrink-0 mx-1" />

          {/* Botón de Disponibilidad (En Stock) anclado */}
          <button
            type="button"
            onClick={() => setSoloEnStock((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 flex items-center gap-1.5 border ${
              soloEnStock
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/25'
                : 'bg-themeCard/90 hover:bg-themeCard text-themeTextMuted hover:text-emerald-400 border border-themeBorder/80'
            }`}
            title={soloEnStock ? 'Mostrando solo productos con stock disponible' : 'Filtrar por productos en stock'}
          >
            <Package size={13} />
            <span className="hidden md:inline">{soloEnStock ? 'En Stock ✓' : 'Disponibilidad'}</span>
            <span className="md:hidden">{soloEnStock ? 'Stock' : 'Todos'}</span>
          </button>
        </div>
      )}

      {/* 🏷️ AVISO DE FILTRADO AUTOMÁTICO POR COMPARADOR */}
      {tipoComparando && (
        <div className="flex items-center justify-between gap-3 bg-themeCard/90 border border-themeAccent/30 px-4 py-2.5 rounded-xl shadow-sm text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-themeAccent shrink-0" />
            <span className="text-themeText font-medium">
              Comparando <strong className="text-themeAccent font-black">{tipoComparando.label}</strong> ({comparadorItems.length}/3)
            </span>
          </div>
          <button
            type="button"
            onClick={limpiarComparador}
            className="text-[11px] font-bold text-themeTextMuted hover:text-red-400 transition-colors cursor-pointer"
          >
            Quitar filtro
          </button>
        </div>
      )}

      {/* ⏳ PANTALLA DE CARGA */}
      {cargando && productosDB.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-themeAccent">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="text-themeTextMuted font-medium animate-pulse">Conectando con el inventario...</p>
        </div>
      ) : (
        /* CUADRÍCULA DE PRODUCTOS FILTRADOS */
        productosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productosFiltrados.map((producto) => (
              <TarjetaProducto key={producto.id} producto={producto} isAdmin={isAdmin} onEditar={abrirEdicion} />
            ))}
          </div>
        ) : (
          /* 📭 MENSAJE DE CONTROL CUANDO NO HAY COINCIDENCIAS */
          <div className="text-center py-16 bg-themeCard rounded-2xl border-2 border-dashed border-themeBorder transition-all duration-500">
            <p className="text-themeText font-medium text-lg">No encontramos resultados para tu búsqueda</p>
            <p className="text-themeTextMuted text-sm mt-1">Prueba revisando la ortografía o cambiando de categoría.</p>
            <button 
              onClick={() => { setBusqueda(''); setGrupoActivo('Todos'); setTipoActivo('todos'); setSoloEnStock(false); }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-themeAccent hover:bg-themeAccentHover rounded-lg transition-colors active:scale-95"
            >
              Restablecer filtros
            </button>
          </div>
        )
      )}

      {/* Modal único para agregar / editar productos (solo administradores) */}
      {isAdmin && (
        <Suspense fallback={null}>
          <AdminProductoModal isOpen={modalOpen} onClose={cerrarModal} productoAEditar={productoEnEdicion} />
        </Suspense>
      )}
    </div>
  );
}