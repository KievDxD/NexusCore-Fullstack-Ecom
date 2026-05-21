import { useState, useEffect } from 'react';
import TarjetaProducto from '../components/TarjetaProducto';
import { type Producto } from '../hooks/useCarrito';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<'Todos' | 'Componentes' | 'Periféricos'>('Todos');
  
  // 🆕 Nuevos estados para guardar los datos reales y saber si están cargando
  const [productosDB, setProductosDB] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  // 🆕 Función mágica que habla con Supabase al abrir la página
  useEffect(() => {
    const cargarProductos = async () => {
      setCargando(true);
      // Le pedimos a Supabase TODOS los productos de la tabla 'productos'
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('id', { ascending: true }); // Ordenados por ID

      if (error) {
        console.error('Error cargando la base de datos:', error.message);
      } else {
        setProductosDB(data || []); // Guardamos los datos reales en el estado
      }
      setCargando(false);
    };

    cargarProductos();
  }, []);

  // Ahora el filtro usa productosDB en lugar de la lista falsa
  const productosFiltrados = productosDB.filter((producto) => {
    const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoriaActiva === 'Todos' || producto.categoria === categoriaActiva;
    return coincideBusqueda && coincideCategoria;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 🛠️ BARRA DE FILTROS Y BUSCADOR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        
        {/* Buscador de texto */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar hardware o periférico..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-4 pr-10 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-800"
          />
          {busqueda && (
            <button 
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold"
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
              className={`px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 ${
                categoriaActiva === cat
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ⏳ PANTALLA DE CARGA */}
      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="text-gray-500 font-medium animate-pulse">Conectando con el inventario...</p>
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
          <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium text-lg">No encontramos resultados para tu búsqueda</p>
            <p className="text-gray-400 text-sm mt-1">Prueba revisando la ortografía o cambiando de categoría.</p>
            <button 
              onClick={() => { setBusqueda(''); setCategoriaActiva('Todos'); }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              Restablecer filtros
            </button>
          </div>
        )
      )}
    </div>
  );
}