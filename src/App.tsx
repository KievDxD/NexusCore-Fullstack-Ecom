import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Asegúrate de tener este archivo
import { useSettings } from './hooks/useSettings';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CarritoSidebar from './components/CarritoSidebar';
import Home from './pages/Home';
import Login from './pages/Login'; // Asegúrate de tener este archivo
import PaginaProducto from './pages/PaginaProducto';
import { Toaster } from 'sonner';

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

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className={`min-h-screen transition-colors duration-500 text-current ${backgroundColor} ${getThemeClass(backgroundColor)}`}>
          <Toaster position="bottom-right" theme={backgroundColor.includes('bg-slate-50') || backgroundColor.includes('bg-amber-50') ? 'light' : 'dark'} richColors />
          
          {/* 🧭 La Navbar siempre es visible */}
          <Navbar onAbrirCarrito={() => setCarritoAbierto(true)} />
          
          {/* 🛤️ Definición de rutas */}
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
          </Routes>

          {/* 🛒 El carrito también es global */}
          <CarritoSidebar 
            isOpen={carritoAbierto} 
            onClose={() => setCarritoAbierto(false)} 
          /> 
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}