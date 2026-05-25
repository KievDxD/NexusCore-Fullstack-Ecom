import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User as UserIcon, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// Definimos los 3 estados posibles de nuestra pantalla
type ModoFormulario = 'login' | 'registro' | 'recuperar';

export default function Login() {
  const [modo, setModo] = useState<ModoFormulario>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState(''); // 🆕 Doble validación
  const [username, setUsername] = useState(''); // 🆕 Estado para el usuario
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false); // 🆕 Mostrar/ocultar contraseña
  const [verConfirmarPassword, setVerConfirmarPassword] = useState(false); // 🆕 Mostrar/ocultar confirmación

  const { login, registro } = useAuth();
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
        toast.success('¡Sesión iniciada!', {
          description: 'Te damos la bienvenida a NEXUS // CORE.',
          duration: 2500,
        });
        navigate('/'); 

      } else if (modo === 'registro') {
        // 📝 REGISTRARSE (Con doble validación y auto-login)
        if (username.trim().length < 3) {
          throw new Error("El username debe tener al menos 3 letras");
        }
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        if (password !== confirmarPassword) {
          throw new Error("Las contraseñas no coinciden. Por favor verifícalas.");
        }
        
        await registro(email, password, username.trim());
        
        toast.success('¡Registro exitoso!', {
          description: `Bienvenido a NEXUS // CORE @${username.toLowerCase()}. Tu sesión ha sido iniciada.`,
          duration: 3500,
        });
        
        // Mantener al usuario registrado logueado e ir a home directo
        navigate('/');

      } else if (modo === 'recuperar') {
        // 🔑 RECUPERAR CONTRASEÑA
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'http://localhost:5173/ajustes', // A donde lo mandará el correo
        });
        if (resetError) throw resetError;

        toast.success('Instrucciones enviadas', {
          description: 'Revisa tu correo para restablecer tu contraseña.',
          duration: 3000,
        });
        setMensajeExito('Te hemos enviado un correo con las instrucciones para cambiar tu contraseña.');
        setModo('login');
      }
    } catch (err: any) {
      const msg = err.message || 'Ocurrió un error al procesar la solicitud';
      setError(msg);
      toast.error('Error', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const cambiarModo = (nuevoModo: ModoFormulario) => {
    setModo(nuevoModo);
    setError(null);
    setMensajeExito(null);
    setPassword('');
    setConfirmarPassword('');
    setVerPassword(false);
    setVerConfirmarPassword(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 animate-fade-in relative overflow-hidden py-12">
      {/* Círculos decorativos de luz neón cyberpunk de fondo */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-themeAccent/10 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-themeAccent/5 blur-3xl rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-themeCard/60 backdrop-blur-2xl border border-themeBorder/80 rounded-3xl shadow-2xl p-8 md:p-10 transition-all duration-500 text-themeText hover:border-themeAccent/20">
        
        {/* Cabecera dinámica */}
        <div className="text-center mb-8 relative">
          {modo !== 'login' && (
            <button 
              type="button"
              onClick={() => cambiarModo('login')}
              className="absolute left-0 top-1 text-themeTextMuted hover:text-themeText transition-colors p-1.5 hover:bg-themeInput/40 rounded-full"
              title="Volver"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="text-3xl font-black text-themeText tracking-tighter uppercase">
            {modo === 'login' && 'BIENVENIDO'}
            {modo === 'registro' && 'CREAR CUENTA'}
            {modo === 'recuperar' && 'RECUPERAR'}
          </h2>
          <p className="text-themeTextMuted text-xs font-bold uppercase tracking-wider mt-1.5">
            {modo === 'login' && 'Ingresa a NEXUS // CORE'}
            {modo === 'registro' && 'Regístrate e inicia sesión de inmediato'}
            {modo === 'recuperar' && 'Ingresa tu correo para resetear'}
          </p>
        </div>

        {/* Mensajes de Alerta */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-500 border-l-4 border-l-red-500">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed">{error}</p>
          </div>
        )}
        {mensajeExito && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-500 border-l-4 border-l-emerald-500">
            <p className="text-xs font-bold leading-relaxed">{mensajeExito}</p>
          </div>
        )}

        {/* Formulario Dinámico */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Campo: Username (SOLO EN REGISTRO) */}
          {modo === 'registro' && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
                Nombre de usuario (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                  placeholder="ej. kiev_builder"
                />
              </div>
            </div>
          )}

          {/* Campo: Correo (SIEMPRE VISIBLE) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          {/* Campo: Contraseña (SOLO LOGIN Y REGISTRO) */}
          {modo !== 'recuperar' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
                  Contraseña
                </label>
                {/* Botón de Olvidé mi Contraseña */}
                {modo === 'login' && (
                  <button 
                    type="button"
                    onClick={() => cambiarModo('recuperar')}
                    className="text-[10px] font-bold text-themeAccent hover:underline transition-all"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                  <Lock size={16} />
                </div>
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-themeTextMuted hover:text-themeAccent transition-colors"
                  title={verPassword ? "Ocultar" : "Mostrar"}
                >
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Campo: Confirmar Contraseña (SOLO REGISTRO - DOBLE VALIDACIÓN) */}
          {modo === 'registro' && (
            <div className="space-y-1.5 animate-slide-down">
              <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                  <Lock size={16} />
                </div>
                <input
                  type={verConfirmarPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerConfirmarPassword(!verConfirmarPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-themeTextMuted hover:text-themeAccent transition-colors"
                  title={verConfirmarPassword ? "Ocultar" : "Mostrar"}
                >
                  {verConfirmarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Botón Principal Dinámico */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-themeAccent hover:bg-themeAccentHover text-white font-black py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-themeAccent/15 text-xs uppercase tracking-widest mt-2 hover:shadow-themeAccent/35"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : (
              modo === 'login' ? 'Iniciar Sesión' :
              modo === 'registro' ? 'Crear e Iniciar' : 'Enviar instrucciones'
            )}
          </button>
        </form>

        {/* Alternar entre Login y Registro */}
        <div className="mt-6 text-center border-t border-themeBorder/40 pt-5">
          {modo === 'login' ? (
            <button
              type="button"
              onClick={() => cambiarModo('registro')}
              className="text-xs text-themeTextMuted hover:text-themeText transition-colors font-bold"
            >
              ¿No tienes cuenta? <span className="text-themeAccent hover:underline">Crea una aquí</span>
            </button>
          ) : modo === 'registro' ? (
            <button
              type="button"
              onClick={() => cambiarModo('login')}
              className="text-xs text-themeTextMuted hover:text-themeText transition-colors font-bold"
            >
              ¿Ya tienes una cuenta? <span className="text-themeAccent hover:underline">Inicia sesión</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}