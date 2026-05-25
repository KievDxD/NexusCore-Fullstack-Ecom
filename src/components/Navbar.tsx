import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCarrito } from '../hooks/useCarrito';
import { useSettings, type Moneda } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext'; // Asegúrate de tener este contexto
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
  const { user, username, logout } = useAuth(); // Hook de autenticación
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
    } catch (err: any) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-themeCard/80 backdrop-blur-xl border-b border-themeBorder/80 transition-all">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center cursor-pointer select-none group">
            <span className="text-xl font-black tracking-tighter text-themeText">
              NEXUS
              <span className="text-themeAccent font-medium ml-1">//CORE</span>
            </span>
          </Link>

          {/* Acciones */}
          <div className="flex items-center gap-2 md:gap-3">
            
            {/* 👤 Login / Perfil */}
            {user ? (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-bold text-themeTextMuted hidden md:block">
                  @{username || user.email?.split('@')[0]}
                </span>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-themeTextMuted hover:text-red-400 hover:bg-themeInput rounded-full transition-all"
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