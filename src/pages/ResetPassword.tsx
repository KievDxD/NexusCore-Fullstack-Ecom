import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Esperar a que Supabase procese el token del hash de la URL
  useEffect(() => {
    // Supabase lee automáticamente el hash fragment con el recovery token
    // y emite un evento PASSWORD_RECOVERY al listener onAuthStateChange.
    // Necesitamos esperar a que la sesión de recuperación esté activa.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true);
      } else if (event === 'SIGNED_IN' && session) {
        // También se emite SIGNED_IN en algunos flujos de recovery
        setSessionReady(true);
      }
    });

    // Verificar si ya hay una sesión activa (por si la página se cargó después)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    // Timeout para no dejar al usuario esperando infinitamente si el enlace es inválido
    const timeout = setTimeout(() => {
      setSessionReady((prev) => {
        if (!prev) {
          setError('El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo desde la pantalla de login.');
        }
        return prev;
      });
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden. Verifica e intenta de nuevo.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        // Traducir errores comunes
        let msg = updateError.message;
        if (msg.includes('same_password')) {
          msg = 'La nueva contraseña no puede ser igual a la anterior.';
        } else if (msg.includes('weak_password') || msg.includes('too short')) {
          msg = 'La contraseña es demasiado débil. Usa al menos 6 caracteres.';
        }
        throw new Error(msg);
      }

      setSuccess(true);
      toast.success('¡Contraseña actualizada!', {
        description: 'Ahora puedes iniciar sesión con tu nueva contraseña.',
        duration: 4000,
      });

      // Redirigir al home después de un momento
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error inesperado al actualizar la contraseña.';
      setError(errorMsg);
      toast.error('Error', { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 animate-fade-in relative overflow-hidden py-12">
      {/* Decoración de fondo */}
      <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-themeAccent/8 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-themeAccent/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-themeCard/60 backdrop-blur-2xl border border-themeBorder/80 rounded-3xl shadow-2xl p-8 md:p-10 transition-all duration-500 text-themeText hover:border-themeAccent/20">
        
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-themeAccent/10 border border-themeAccent/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-themeAccent" />
          </div>
          <h2 className="text-2xl font-black text-themeText tracking-tighter uppercase">
            {success ? 'CONTRASEÑA ACTUALIZADA' : 'NUEVA CONTRASEÑA'}
          </h2>
          <p className="text-themeTextMuted text-xs font-bold uppercase tracking-wider mt-1.5">
            {success ? 'Redirigiendo al inicio...' : 'Ingresa tu nueva contraseña segura'}
          </p>
        </div>

        {/* Estado: Éxito */}
        {success ? (
          <div className="text-center space-y-4 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck size={36} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-themeTextMuted">
              Tu contraseña se ha cambiado exitosamente. Serás redirigido al inicio automáticamente.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-themeAccent text-xs font-bold hover:underline transition-all"
            >
              Ir al inicio ahora →
            </button>
          </div>
        ) : !sessionReady && !error ? (
          /* Estado: Esperando sesión de recuperación */
          <div className="text-center space-y-4 py-6 animate-fade-in">
            <Loader2 size={32} className="animate-spin text-themeAccent mx-auto" />
            <p className="text-sm font-semibold text-themeTextMuted">
              Verificando enlace de recuperación...
            </p>
          </div>
        ) : (
          /* Formulario de nueva contraseña */
          <>
            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-500 border-l-4 border-l-red-500 animate-fade-in">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold leading-relaxed">{error}</p>
                  {error.includes('inválido') && (
                    <button
                      onClick={() => navigate('/login')}
                      className="text-[10px] font-bold text-themeAccent hover:underline mt-2 block"
                    >
                      ← Volver al Login para solicitar un nuevo enlace
                    </button>
                  )}
                </div>
              </div>
            )}

            {sessionReady && (
              <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
                {/* Nueva contraseña */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
                    Nueva Contraseña
                  </label>
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
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword(!verPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-themeTextMuted hover:text-themeAccent transition-colors"
                    >
                      {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-themeText uppercase tracking-widest">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-themeTextMuted">
                      <Lock size={16} />
                    </div>
                    <input
                      type={verConfirmar ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmarPassword}
                      onChange={(e) => setConfirmarPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold placeholder-themeTextMuted/30 focus:outline-none focus:border-themeAccent focus:ring-2 focus:ring-themeAccent/10 transition-all"
                      placeholder="Repite tu nueva contraseña"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setVerConfirmar(!verConfirmar)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-themeTextMuted hover:text-themeAccent transition-colors"
                    >
                      {verConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Indicador de coincidencia */}
                  {confirmarPassword.length > 0 && (
                    <p className={`text-[10px] font-bold ${password === confirmarPassword ? 'text-emerald-500' : 'text-red-400'}`}>
                      {password === confirmarPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                    </p>
                  )}
                </div>

                {/* Botón de guardar */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-themeAccent hover:bg-themeAccentHover text-white font-black py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-themeAccent/15 text-xs uppercase tracking-widest mt-2 hover:shadow-themeAccent/35 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Nueva Contraseña'}
                </button>
              </form>
            )}
          </>
        )}

        {/* Link de vuelta */}
        {!success && (
          <div className="mt-6 text-center border-t border-themeBorder/40 pt-5">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs text-themeTextMuted hover:text-themeText transition-colors font-bold"
            >
              ← <span className="text-themeAccent hover:underline">Volver al Login</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
