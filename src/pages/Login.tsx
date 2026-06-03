import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User as UserIcon, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, Timer } from 'lucide-react';
import { toast } from 'sonner';

// Definimos los 3 estados posibles de nuestra pantalla
type ModoFormulario = 'login' | 'registro' | 'recuperar';

export default function Login() {
  const [modo, setModo] = useState<ModoFormulario>('login');
  const [identificador, setIdentificador] = useState(''); // Username o email para login, email para registro/recuperar
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmarPassword, setVerConfirmarPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { login, registro } = useAuth();
  const navigate = useNavigate();

  // Detectar si el input parece un email
  const esEmail = identificador.includes('@');
  // Detectar si el input parece un username (sin @, no vacío)
  const esUsername = identificador.trim().length > 0 && !esEmail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensajeExito(null);
    setLoading(true);

    try {
      if (modo === 'login') {
        // 🔓 INICIAR SESIÓN — El AuthContext.login() maneja la resolución username→email
        if (!identificador.trim()) {
          throw new Error("Ingresa tu nombre de usuario o correo electrónico.");
        }
        if (!password) {
          throw new Error("Ingresa tu contraseña.");
        }
        
        await login(identificador, password);
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
        
        const autologin = await registro(identificador, password, username.trim());
        
        if (autologin) {
          toast.success('¡Registro exitoso!', {
            description: `Bienvenido a NEXUS // CORE @${username.trim()}. Tu sesión ha sido iniciada.`,
            duration: 3500,
          });
          navigate('/');
        } else {
          toast.success('¡Cuenta creada!', {
            description: `Revisa tu correo (${identificador}) para confirmar tu cuenta.`,
            duration: 5000,
          });
          setModo('login');
          setMensajeExito('Por favor revisa tu bandeja de entrada o spam para confirmar tu correo electrónico antes de iniciar sesión.');
          setPassword('');
          setConfirmarPassword('');
        }

      } else if (modo === 'recuperar') {
        // 🔑 RECUPERAR CONTRASEÑA
        if (!identificador.includes('@')) {
          throw new Error("Ingresa tu correo electrónico válido para recuperar tu contraseña.");
        }
        
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(identificador, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;

        // Iniciar cooldown de 60 segundos para evitar rate limit
        setCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        toast.success('Instrucciones enviadas', {
          description: 'Revisa tu correo para restablecer tu contraseña.',
          duration: 3000,
        });
        setMensajeExito('Te hemos enviado un correo con las instrucciones para cambiar tu contraseña. Revisa tu bandeja de entrada y spam.');
        setModo('login');
      }
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Ocurrió un error al procesar la solicitud';
      
      // Traducir errores comunes de Supabase al español
      if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'Credenciales incorrectas. Verifica tu usuario/correo y contraseña.';
      } else if (errorMsg.includes('Email not confirmed')) {
        errorMsg = 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.';
      } else if (errorMsg.includes('User already registered')) {
        errorMsg = 'Este correo electrónico ya está registrado. ¿Quieres iniciar sesión?';
      } else if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('too many requests')) {
        errorMsg = 'Has enviado demasiadas solicitudes. Espera un momento antes de intentar de nuevo.';
      }
      
      setError(errorMsg);
      toast.error('Error', { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const cambiarModo = (nuevoModo: ModoFormulario) => {
    setModo(nuevoModo);
    setError(null);
    setMensajeExito(null);
    setIdentificador('');
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
            {modo === 'login' && 'Ingresa con tu usuario o correo'}
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
            <div className="space-y-1.5 animate-slide-down">
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
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  className="w-full pl-11 pr-4 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                  placeholder="ej. kiev_builder"
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                />
              </div>
              <p className="text-[10px] text-themeTextMuted mt-0.5">
                Sin espacios, mínimo 3 caracteres. Este será tu @usuario.
              </p>
            </div>
          )}

          {/* Campo: Identificador (Usuario o Correo en Login, Correo en Registro/Recuperar) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
              {modo === 'login' ? 'Usuario o Correo Electrónico' : 'Correo Electrónico'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                {modo === 'login' && esUsername ? (
                  <UserIcon size={16} className="text-themeAccent transition-colors duration-200" />
                ) : modo === 'login' && esEmail ? (
                  <Mail size={16} className="text-themeAccent transition-colors duration-200" />
                ) : (
                  <Mail size={16} />
                )}
              </div>
              <input
                type={modo === 'login' ? 'text' : 'email'}
                required
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                placeholder={modo === 'login' ? 'ej. kiev_builder o tu@email.com' : 'tu@email.com'}
                autoComplete={modo === 'login' ? 'username' : 'email'}
              />
            </div>
            {/* Indicador visual del modo detectado en login */}
            {modo === 'login' && identificador.trim().length > 0 && (
              <p className="text-[10px] font-bold mt-0.5 transition-colors duration-200" style={{ color: esEmail ? 'rgb(var(--theme-accent))' : 'rgb(var(--theme-text-muted))' }}>
                {esEmail ? '📧 Detectado: correo electrónico' : `👤 Detectado: nombre de usuario "${identificador.replace(/^@/, '')}"`}
              </p>
            )}
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
                  autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
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
                  autoComplete="new-password"
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
              {/* Indicador de coincidencia de contraseñas */}
              {confirmarPassword.length > 0 && (
                <p className={`text-[10px] font-bold ${password === confirmarPassword ? 'text-emerald-500' : 'text-red-400'}`}>
                  {password === confirmarPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                </p>
              )}
            </div>
          )}

          {/* Botón Principal Dinámico */}
          <button
            type="submit"
            disabled={loading || (modo === 'recuperar' && cooldown > 0)}
            className="w-full bg-themeAccent hover:bg-themeAccentHover text-white font-black py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-themeAccent/15 text-xs uppercase tracking-widest mt-2 hover:shadow-themeAccent/35 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : (
              modo === 'login' ? 'Iniciar Sesión' :
              modo === 'registro' ? 'Crear e Iniciar' : 
              cooldown > 0 ? (
                <span className="flex items-center gap-2">
                  <Timer size={14} />
                  Reenviar en {cooldown}s
                </span>
              ) : 'Enviar instrucciones'
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