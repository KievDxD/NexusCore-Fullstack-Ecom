import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Asegúrate de tener este archivo
import { useSettings } from './hooks/useSettings';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CarritoSidebar from './components/CarritoSidebar';
import Home from './pages/Home';
import Login from './pages/Login'; // Asegúrate de tener este archivo

export default function App() {
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Estados globales de configuración
  const fetchRates = useSettings((state) => state.fetchRates);
  const backgroundColor = useSettings((state) => state.backgroundColor);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className={`min-h-screen transition-colors duration-500 text-current ${backgroundColor}`}>
          
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