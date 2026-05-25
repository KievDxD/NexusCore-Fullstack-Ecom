import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { X, Settings, Check, User, ShieldAlert, Palette, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PestañaAjustes = 'apariencia' | 'perfil' | 'admin';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { backgroundColor, currency, setSettings, whatsappNumber, setWhatsappNumber } = useSettings();
  const { user, role, username, isAdmin, actualizarUsername } = useAuth();
  
  // Tab activa
  const [tabActiva, setTabActiva] = useState<PestañaAjustes>('apariencia');

  // Estados locales para inputs
  const [numInput, setNumInput] = useState(whatsappNumber);
  const [userInput, setUserInput] = useState(username || '');
  const [guardandoUser, setGuardandoUser] = useState(false);

  // Sincronizar inputs al abrir el modal o cambiar datos
  useEffect(() => {
    if (isOpen) {
      setNumInput(whatsappNumber);
      setUserInput(username || '');
      // Restablecer a pestaña apariencia si cierra y vuelve a abrir
      setTabActiva('apariencia');
    }
  }, [whatsappNumber, username, isOpen]);

  const opcionesColores = [
    { name: 'Claro Minimalista', class: 'bg-slate-50 text-gray-900', dot: 'bg-slate-200' },
    { name: 'Cálido Crema', class: 'bg-amber-50/60 text-amber-950', dot: 'bg-amber-100' },
    { name: 'Cyberpunk Oscuro', class: 'bg-zinc-950 text-zinc-50', dot: 'bg-zinc-900' },
    { name: 'Azul Nocturno', class: 'bg-slate-900 text-slate-100', dot: 'bg-slate-800' },
  ];

  const handleSaveNumber = () => {
    const cleaned = numInput.replace(/[^0-9]/g, '');
    
    if (cleaned.length < 8) {
      toast.error("Número no válido", {
        description: "Debe ingresar el código de país y número (mínimo 8 dígitos).",
      });
      return;
    }

    setWhatsappNumber(cleaned);
    toast.success("WhatsApp de la tienda actualizado", {
      description: `Los pedidos se redirigirán a: +${cleaned}`,
    });
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const cleanUsername = userInput.trim().toLowerCase();
    
    if (cleanUsername.length < 3) {
      toast.error("Nombre de usuario muy corto", {
        description: "El nombre de usuario debe tener al menos 3 letras.",
      });
      return;
    }

    setGuardandoUser(true);
    try {
      await actualizarUsername(cleanUsername);

      toast.success("¡Username actualizado!", {
        description: `Tu perfil se mostrará al instante como @${cleanUsername}.`,
      });
    } catch (err: any) {
      toast.error("Error al actualizar username", {
        description: err.message || "Es posible que el nombre de usuario ya esté registrado.",
      });
    } finally {
      setGuardandoUser(false);
    }
  };

  const cambiarTema = (claseTema: string, nombreTema: string) => {
    setSettings({ backgroundColor: claseTema });
    toast.success(`Tema aplicado: ${nombreTema}`, {
      duration: 1500,
    });
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
      
      {/* Fondo opaco */}
      <div 
        onClick={onClose}
        className={`fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Panel lateral */}
      <div className={`absolute top-0 right-0 w-full max-w-md h-full bg-themeCard border-l border-themeBorder text-themeText shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Encabezado */}
        <div className="flex items-center justify-between p-6 border-b border-themeBorder bg-themeInput">
          <div className="flex items-center gap-3">
            <div className="bg-themeAccent/10 p-2.5 rounded-xl">
              <Settings className="w-5 h-5 text-themeAccent animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-black text-themeText tracking-tight">AJUSTES</h2>
              <p className="text-[10px] text-themeTextMuted font-bold uppercase tracking-wider">Centro de personalización</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-themeTextMuted hover:text-themeText transition-colors p-2 hover:bg-themeCard rounded-full active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestañas (Tabs) Estilo Premium */}
        <div className="flex border-b border-themeBorder bg-themeInput/40 p-1.5 gap-1">
          <button
            onClick={() => setTabActiva('apariencia')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${tabActiva === 'apariencia' ? 'bg-themeCard text-themeAccent shadow-sm border border-themeBorder/40' : 'text-themeTextMuted hover:text-themeText'}`}
          >
            <Palette size={14} />
            Apariencia
          </button>

          {user && (
            <button
              onClick={() => setTabActiva('perfil')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${tabActiva === 'perfil' ? 'bg-themeCard text-themeAccent shadow-sm border border-themeBorder/40' : 'text-themeTextMuted hover:text-themeText'}`}
            >
              <User size={14} />
              Mi Perfil
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setTabActiva('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${tabActiva === 'admin' ? 'bg-themeCard text-red-500 shadow-sm border border-themeBorder/40' : 'text-themeTextMuted hover:text-red-400'}`}
            >
              <ShieldAlert size={14} />
              Admin
            </button>
          )}
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* pestaña 1: APARIENCIA */}
          {tabActiva === 'apariencia' && (
            <div className="space-y-6 animate-fade-in">
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black text-themeText uppercase tracking-widest">Tema Visual</h3>
                  <span className="text-[10px] bg-themeAccent/10 text-themeAccent px-2 py-0.5 rounded font-bold">4 Temas</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {opcionesColores.map((color) => (
                    <button
                      key={color.class}
                      onClick={() => cambiarTema(color.class, color.name)}
                      className={`flex flex-col items-center p-3.5 rounded-xl border-2 transition-all ${backgroundColor === color.class ? 'border-themeAccent bg-themeAccent/10 text-themeText shadow-sm' : 'border-themeBorder hover:border-themeAccent/30 bg-themeInput/25'}`}
                    >
                      <div className={`w-8 h-8 rounded-full mb-2 ${color.dot} flex items-center justify-center shadow-inner`}>
                        {backgroundColor === color.class && <Check className="w-4 h-4 text-themeAccent" />}
                      </div>
                      <span className="text-xs font-bold text-themeText text-center">{color.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">Moneda Principal</h3>
                <div className="flex gap-2">
                  {['COP', 'USD', 'MXN'].map((moneda) => (
                    <button
                      key={moneda}
                      onClick={() => setSettings({ currency: moneda as any })}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs transition-all border-2 ${currency === moneda ? 'border-themeAccent bg-themeAccent/15 text-themeAccent' : 'border-themeBorder text-themeTextMuted hover:border-themeAccent/30 bg-themeInput/20'}`}
                    >
                      {moneda}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2 leading-relaxed">
                  Los valores del catálogo se convertirán de manera automatizada utilizando tasas de cambio sincronizadas del día.
                </p>
              </section>
            </div>
          )}

          {/* pestaña 2: PERFIL DE USUARIO */}
          {tabActiva === 'perfil' && user && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-4 bg-themeInput/30 p-4 rounded-2xl border border-themeBorder/60">
                <img 
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-xl bg-themeAccent/10 p-1 border border-themeBorder"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-themeTextMuted font-bold uppercase tracking-wider">{role || 'Usuario'}</p>
                  <p className="text-sm font-black text-themeText truncate">@{username || 'sin_username'}</p>
                  <p className="text-[11px] text-themeTextMuted truncate mt-0.5">{user.email}</p>
                </div>
              </div>

              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">Nombre de usuario (Username)</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-themeTextMuted font-bold">@</span>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="nuevo_username"
                      className="w-full pl-7 pr-3 py-2.5 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSaveUsername}
                    disabled={guardandoUser}
                    className="bg-themeAccent hover:bg-themeAccentHover text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-themeAccent/15 flex items-center justify-center min-w-[90px]"
                  >
                    {guardandoUser ? <Loader2 size={16} className="animate-spin" /> : "Guardar"}
                  </button>
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2 leading-relaxed">
                  Tu nombre de usuario es único en la plataforma y se mostrará al publicar reseñas o valoraciones en los productos.
                </p>
              </section>
            </div>
          )}

          {/* pestaña 3: PANEL ADMIN */}
          {tabActiva === 'admin' && isAdmin && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-500">
                <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">ÁREA ADMINISTRATIVA</h4>
                  <p className="text-[10px] font-medium leading-relaxed mt-1">
                    Como administrador de NEXUS//CORE, tienes control exclusivo sobre la pasarela de redirección y números de envío telefónico.
                  </p>
                </div>
              </div>

              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">WhatsApp de Pedidos</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={numInput}
                    onChange={(e) => setNumInput(e.target.value)}
                    placeholder="Ej. 573043104831"
                    className="flex-1 px-4 py-2.5 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent transition-all"
                  />
                  <button
                    onClick={handleSaveNumber}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-red-500/10"
                  >
                    Guardar
                  </button>
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2 leading-normal">
                  Ingresa el código de país seguido del número sin espacios ni el signo "+". <br />
                  Ejemplo: *573043104831* (Colombia) o *5215512345678* (México).
                </p>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}