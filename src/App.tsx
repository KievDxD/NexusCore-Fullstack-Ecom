import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useSettings } from './hooks/useSettings';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CarritoSidebar from './components/CarritoSidebar';
import SmoothScroller from './components/SmoothScroller';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

// ⚡ Lazy loading: estas páginas se cargan solo cuando el usuario navega a ellas
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const PaginaProducto = lazy(() => import('./pages/PaginaProducto'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Fallback de carga para Suspense
function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-themeAccent">
      <Loader2 size={36} className="animate-spin mb-3" />
      <p className="text-themeTextMuted text-xs font-bold uppercase tracking-widest animate-pulse">Cargando...</p>
    </div>
  );
}

export default function App() {
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Estados globales de configuración
  const fetchRates = useSettings((state) => state.fetchRates);
  const backgroundColor = useSettings((state) => state.backgroundColor);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Resolver la clase del tema correspondiente para aplicar variables CSS globales
  const getThemeClass = (bg: string) => {
    if (bg.includes('bg-slate-50')) return 'theme-claro';
    if (bg.includes('bg-amber-50')) return 'theme-crema';
    if (bg.includes('bg-zinc-950')) return 'theme-cyberpunk';
    if (bg.includes('bg-slate-900')) return 'theme-nocturno';
    return 'theme-claro';
  };

  const themeClass = getThemeClass(backgroundColor);

  // Sincronizar la clase de tema con <html> para que el scrollbar del navegador
  // (que pertenece al documento raíz, no al div de React) use las variables CSS correctas
  useEffect(() => {
    const html = document.documentElement;
    // Limpiar clases de tema anteriores
    html.classList.remove('theme-claro', 'theme-crema', 'theme-cyberpunk', 'theme-nocturno');
    // Aplicar la nueva
    html.classList.add(themeClass);
  }, [themeClass]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className={`min-h-screen transition-colors duration-500 text-current ${backgroundColor} ${themeClass}`}>
            <SmoothScroller />
          <Toaster position="bottom-right" theme={backgroundColor.includes('bg-slate-50') || backgroundColor.includes('bg-amber-50') ? 'light' : 'dark'} richColors />
          
          {/* 🧭 La Navbar siempre es visible */}
          <Navbar onAbrirCarrito={() => setCarritoAbierto(true)} />
          
          {/* 🛤️ Definición de rutas con lazy loading */}
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Ruta Principal: Hero + Catálogo */}
              <Route path="/" element={
                <>
                  <Hero /> 
                  <main className="container mx-auto px-4 py-8">
                    <Home />
                  </main>
                </>
              } />

              {/* Ruta de Login */}
              <Route path="/login" element={<Login />} />

              {/* Ruta de Detalle de Producto */}
              <Route path="/producto/:id" element={
                <main className="container mx-auto px-4 py-8">
                  <PaginaProducto />
                </main>
              } />

              {/* Ruta de Restablecer Contraseña */}
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
          </Suspense>

          {/* 🛒 El carrito también es global */}
          <CarritoSidebar 
            isOpen={carritoAbierto} 
            onClose={() => setCarritoAbierto(false)} 
          /> 
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}