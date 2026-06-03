import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCarrito } from '../hooks/useCarrito';
import { useSettings, type Moneda } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Settings, Globe, User, LogOut } from 'lucide-react';
import SettingsModal from './SettingsModal';
import { toast } from 'sonner';

interface NavbarProps {
  onAbrirCarrito: () => void;
}

export default function Navbar({ onAbrirCarrito }: NavbarProps) {
  // Estados y Hooks
  const { items } = useCarrito();
  const totalArticulos = items.reduce((sum, item) => sum + item.cantidad, 0);
  const { currency, setCurrency } = useSettings();
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  // Lógica de Moneda
  const toggleMoneda = () => {
    const monedas: Moneda[] = ['COP', 'USD', 'MXN'];
    const siguiente = monedas[(monedas.indexOf(currency) + 1) % monedas.length];
    setCurrency(siguiente);
    toast.info(`Precios convertidos a ${siguiente}`, {
      description: "Las tasas se actualizan en tiempo real.",
      duration: 1500,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada correctamente");
      navigate('/');
    } catch {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-themeCard/80 backdrop-blur-xl border-b border-themeBorder/80 transition-all">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo minimalista responsivo (se adapta al color del tema como Spotify/YouTube) */}
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer select-none group">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="w-7.5 h-7.5 text-themeAccent transition-transform duration-300 group-hover:scale-105"
            >
              {/* Contenedor redondeado con opacidad sutil del color de acento */}
              <rect x="2" y="2" width="20" height="20" rx="6" className="fill-themeAccent/10 stroke-themeAccent/15" strokeWidth="1.5" />
              {/* Isotipo N */}
              <path d="M7 16V8l5 5.5V8" className="stroke-themeAccent" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Doble slash // */}
              <path d="M14 14.5l1.5-4.5M16.5 14.5l1.5-4.5" className="stroke-themeAccent" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-black tracking-tighter text-themeText flex items-center">
              NEXUS
              <span className="text-themeAccent font-normal mx-0.5">//</span>
              CORE
            </span>
          </Link>

          {/* Acciones */}
          <div className="flex items-center gap-2 md:gap-3">
            
            {/* Login / Perfil */}
            {user ? (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-bold text-themeTextMuted hidden md:block truncate max-w-[120px]">
                  @{username || user.email?.split('@')[0]}
                </span>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-themeTextMuted hover:text-red-400 hover:bg-themeInput rounded-full transition-all active:scale-95"
                  title="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link 
                to="/login"
                className="p-2 text-themeTextMuted hover:text-themeAccent hover:bg-themeInput rounded-full transition-all"
                title="Iniciar Sesión"
              >
                <User size={18} />
              </Link>
            )}

            {/* Separador sutil */}
            <div className="h-4 w-[1px] bg-themeBorder mx-1" />

            {/* Selector de Moneda */}
            <button 
              onClick={toggleMoneda}
              className="flex items-center gap-1.5 bg-themeInput border border-themeBorder hover:border-themeAccent/50 px-3 py-1.5 rounded-full transition-all active:scale-95 group"
            >
              <Globe size={14} className="text-themeTextMuted group-hover:text-themeAccent transition-colors" />
              <span className="text-xs font-bold text-themeText">{currency}</span>
            </button>

            {/* Botón Ajustes */}
            <button 
              onClick={() => setAjustesAbiertos(true)} 
              className="p-2 text-themeTextMuted hover:text-themeAccent hover:bg-themeInput rounded-full transition-all active:scale-95"
            >
              <Settings size={18} />
            </button>

            {/* Botón Carrito */}
            <button 
              onClick={onAbrirCarrito}
              className="p-2 text-themeTextMuted hover:text-themeAccent hover:bg-themeInput rounded-full transition-all active:scale-95 relative"
            >
              <ShoppingCart size={18} />
              {totalArticulos > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-themeAccent text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-lg shadow-themeAccent/20 animate-pulse">
                  {totalArticulos}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <SettingsModal 
        isOpen={ajustesAbiertos} 
        onClose={() => setAjustesAbiertos(false)} 
      />
    </>
  );
}