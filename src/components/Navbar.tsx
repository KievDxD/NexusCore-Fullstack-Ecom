import { useState, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCarritoCount } from '../hooks/useCarrito';
import { useSettings, type Moneda } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Settings, Globe, User, LogOut, Cpu } from 'lucide-react';
import { toast } from 'sonner';

const SettingsModal = lazy(() => import('./SettingsModal'));
const PCBuilderModal = lazy(() => import('./PCBuilderModal'));

interface NavbarProps {
  onAbrirCarrito: () => void;
}

export default function Navbar({ onAbrirCarrito }: NavbarProps) {
  const totalArticulos = useCarritoCount();
  const currency = useSettings((s) => s.currency);
  const setCurrency = useSettings((s) => s.setCurrency);
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [builderAbierto, setBuilderAbierto] = useState(false);

  const toggleMoneda = () => {
    const monedas: Moneda[] = ['COP', 'USD', 'MXN'];
    const siguiente = monedas[(monedas.indexOf(currency) + 1) % monedas.length];
    setCurrency(siguiente);
    toast.info(`Precios convertidos a ${siguiente}`, {
      description: 'Las tasas se actualizan en tiempo real.',
      duration: 1500,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesión cerrada correctamente');
      navigate('/');
    } catch {
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-themeCard/80 backdrop-blur-xl border-b border-themeBorder/80 transition-all">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo minimalista responsivo */}
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer select-none group">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-[30px] h-[30px] text-themeAccent transition-transform duration-300 group-hover:scale-105"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="6"
                className="fill-themeAccent/10 stroke-themeAccent/15"
                strokeWidth="1.5"
              />
              <path
                d="M7 16V8l5 5.5V8"
                className="stroke-themeAccent"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14.5l1.5-4.5M16.5 14.5l1.5-4.5"
                className="stroke-themeAccent"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-lg font-black tracking-tighter text-themeText flex items-center">
              NEXUS
              <span className="text-themeAccent font-normal mx-0.5">//</span>
              CORE
            </span>
          </Link>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Botón Armador de PC Interactivo */}
            <button
              type="button"
              onClick={() => setBuilderAbierto(true)}
              className="flex items-center gap-1.5 bg-themeAccent/10 hover:bg-themeAccent text-themeAccent hover:text-white border border-themeAccent/30 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95"
              title="Armador de PC Interactivo con Verificador de Compatibilidad"
            >
              <Cpu size={14} />
              <span className="hidden sm:inline">Armar PC</span>
            </button>

            {/* Login / Perfil */}
            {user ? (
              <div className="flex items-center gap-1.5 mr-1">
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
            <div className="h-4 w-[1px] bg-themeBorder mx-0.5" />

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
              title="Ajustes y Panel de Control"
            >
              <Settings size={18} />
            </button>

            {/* Botón Carrito */}
            <button
              onClick={onAbrirCarrito}
              className="p-2 text-themeTextMuted hover:text-themeAccent hover:bg-themeInput rounded-full transition-all active:scale-95 relative"
              title="Tu Carrito"
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

      <Suspense fallback={null}>
        <SettingsModal isOpen={ajustesAbiertos} onClose={() => setAjustesAbiertos(false)} />
      </Suspense>

      <Suspense fallback={null}>
        <PCBuilderModal
          isOpen={builderAbierto}
          onClose={() => setBuilderAbierto(false)}
          onAbrirCarrito={onAbrirCarrito}
        />
      </Suspense>
    </>
  );
}
