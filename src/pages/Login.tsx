import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User as UserIcon, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

// Definimos los 3 estados posibles de nuestra pantalla
type ModoFormulario = 'login' | 'registro' | 'recuperar';

export default function Login() {
  const [modo, setModo] = useState<ModoFormulario>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // 🆕 Nuevo estado para el usuario
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensajeExito(null);
    setLoading(true);

    try {
      if (modo === 'login') {
        // 🔓 INICIAR SESIÓN
        await login(email, password);
        navigate('/'); 

      } else if (modo === 'registro') {
        // 📝 REGISTRARSE (Ahora guardamos el username)
        if (username.length < 3) throw new Error("El username debe tener al menos 3 letras");
        
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.toLowerCase() } // Lo guardamos en minúsculas para que sea único
          }
        });
        if (signUpError) throw signUpError;
        
        setMensajeExito('¡Registro exitoso! Ya puedes iniciar sesión con tu nueva cuenta.');
        setModo('login');
        setPassword('');

      } else if (modo === 'recuperar') {
        // 🔑 RECUPERAR CONTRASEÑA
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'http://localhost:5173/ajustes', // A donde lo mandará el correo
        });
        if (resetError) throw resetError;

        setMensajeExito('Te hemos enviado un correo con las instrucciones para cambiar tu contraseña.');
        setModo('login');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8">
        
        {/* Cabecera dinámica */}
        <div className="text-center mb-8 relative">
          {modo !== 'login' && (
            <button 
              onClick={() => { setModo('login'); setError(null); setMensajeExito(null); }}
              className="absolute left-0 top-1 text-slate-400 hover:text-white transition-colors"
              title="Volver"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-3xl font-black text-white tracking-tight">
            {modo === 'login' && 'Bienvenido'}
            {modo === 'registro' && 'Crear Cuenta'}
            {modo === 'recuperar' && 'Recuperar Acceso'}
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            {modo === 'login' && 'Ingresa a NEXUS // CORE'}
            {modo === 'registro' && 'Únete para gestionar tus compras y reseñas'}
            {modo === 'recuperar' && 'Ingresa tu correo para resetear tu contraseña'}
          </p>
        </div>

        {/* Mensajes de Alerta */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {mensajeExito && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-emerald-400">
            <p className="text-sm font-medium">{mensajeExito}</p>
          </div>
        )}

        {/* Formulario Dinámico */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Campo: Username (SOLO EN REGISTRO) */}
          {modo === 'registro' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Username único
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="ej. kiev_nexus"
                />
              </div>
            </div>
          )}

          {/* Campo: Correo (SIEMPRE VISIBLE) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          {/* Campo: Contraseña (SOLO LOGIN Y REGISTRO) */}
          {modo !== 'recuperar' && (
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </label>
                {/* Botón de Olvidé mi Contraseña */}
                {modo === 'login' && (
                  <button 
                    type="button"
                    onClick={() => { setModo('recuperar'); setError(null); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {/* Botón Principal Dinámico */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              modo === 'login' ? 'Iniciar Sesión' :
              modo === 'registro' ? 'Crear Cuenta' : 'Enviar instrucciones'
            )}
          </button>
        </form>

        {/* Alternar entre Login y Registro */}
        {modo === 'login' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setModo('registro'); setError(null); }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ¿No tienes cuenta? <span className="text-indigo-400">Regístrate aquí</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}