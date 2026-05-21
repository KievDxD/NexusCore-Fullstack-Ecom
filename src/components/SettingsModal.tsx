import { useSettings } from '../hooks/useSettings';
import { X, Settings, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { backgroundColor, currency, setSettings } = useSettings();

  const opcionesColores = [
    { name: 'Claro Minimalista', class: 'bg-slate-50 text-gray-900', dot: 'bg-slate-200' },
    { name: 'Cálido Crema', class: 'bg-amber-50/60 text-amber-950', dot: 'bg-amber-100' },
    { name: 'Cyberpunk Oscuro', class: 'bg-zinc-950 text-zinc-50', dot: 'bg-zinc-900' },
    { name: 'Azul Nocturno', class: 'bg-slate-900 text-slate-100', dot: 'bg-slate-800' },
  ];

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
      
      {/* Fondo opaco detrás */}
      <div 
        onClick={onClose}
        className={`fixed inset-0 bg-black transition-opacity duration-300 ${isOpen ? 'bg-opacity-40 backdrop-blur-sm' : 'bg-opacity-0'}`} 
      />

      {/* Panel lateral derecho */}
      <div className={`absolute top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Ajustes</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* SECCIÓN 1: Tema de la Tienda */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Tema de la tienda</h3>
            <div className="grid grid-cols-2 gap-3">
              {opcionesColores.map((color) => (
                <button
                  key={color.class}
                  onClick={() => setSettings({ backgroundColor: color.class })}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${backgroundColor === color.class ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-8 h-8 rounded-full mb-2 ${color.dot} flex items-center justify-center`}>
                    {backgroundColor === color.class && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">{color.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* SECCIÓN 2: Moneda */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Moneda Principal</h3>
            <div className="flex gap-2">
              {['COP', 'USD', 'MXN'].map((moneda) => (
                <button
                  key={moneda}
                  onClick={() => setSettings({ currency: moneda as any })}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all border-2 ${currency === moneda ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                >
                  {moneda}
                </button>
              ))}
            </div>
          </section>
          

        </div>
      </div>
    </div>
  );
}