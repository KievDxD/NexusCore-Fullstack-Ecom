import { useState } from 'react';
import TarjetaProducto from '../components/TarjetaProducto';
import { useProductos } from '../hooks/useProductos';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<'Todos' | 'Componentes' | 'Periféricos'>('Todos');
  
  // 🆕 Usamos nuestro hook premium con soporte de fallback local y control de stock
  const { productos: productosDB, cargando } = useProductos();

  // Ahora el filtro usa productosDB en lugar de la lista falsa
  const productosFiltrados = productosDB.filter((producto) => {
    const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoriaActiva === 'Todos' || producto.categoria === categoriaActiva;
    return coincideBusqueda && coincideCategoria;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
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

        {/* Botones de Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(['Todos', 'Componentes', 'Periféricos'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                categoriaActiva === cat
                  ? 'bg-themeAccent text-white shadow-md shadow-themeAccent/15'
                  : 'bg-themeInput text-themeTextMuted hover:bg-themeBorder hover:text-themeText'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ⏳ PANTALLA DE CARGA */}
      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 text-themeAccent">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="text-themeTextMuted font-medium animate-pulse">Conectando con el inventario...</p>
        </div>
      ) : (
        /* CUADRÍCULA DE PRODUCTOS FILTRADOS */
        productosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productosFiltrados.map((producto) => (
              <TarjetaProducto key={producto.id} producto={producto} />
            ))}
          </div>
        ) : (
          /* 📭 MENSAJE DE CONTROL CUANDO NO HAY COINCIDENCIAS */
          <div className="text-center py-16 bg-themeCard rounded-2xl border-2 border-dashed border-themeBorder transition-all duration-500">
            <p className="text-themeText font-medium text-lg">No encontramos resultados para tu búsqueda</p>
            <p className="text-themeTextMuted text-sm mt-1">Prueba revisando la ortografía o cambiando de categoría.</p>
            <button 
              onClick={() => { setBusqueda(''); setCategoriaActiva('Todos'); }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-themeAccent hover:bg-themeAccentHover rounded-lg transition-colors active:scale-95"
            >
              Restablecer filtros
            </button>
          </div>
        )
      )}
    </div>
  );
}