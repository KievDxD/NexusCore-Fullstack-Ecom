import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { useProductos } from '../hooks/useProductos';
import { X, Settings, Check, User, ShieldAlert, Palette, Loader2, Upload, Package } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PestañaAjustes = 'apariencia' | 'perfil' | 'admin';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { backgroundColor, currency, setSettings, whatsappNumber, setWhatsappNumber } = useSettings();
  const { user, role, username, avatarUrl, actualizarAvatar, subirAvatar, isAdmin, actualizarUsername } = useAuth();
  
  // Tab activa
  const [tabActiva, setTabActiva] = useState<PestañaAjustes>('apariencia');

  // Estados locales para inputs
  const [numInput, setNumInput] = useState(whatsappNumber);
  const [userInput, setUserInput] = useState(username || '');
  const [guardandoUser, setGuardandoUser] = useState(false);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);

  // Estados Admin
  const { productos, bulkUpdateStock, bulkCategoryDiscount } = useProductos();
  const [catDiscounts, setCatDiscounts] = useState<Record<string, number | ''>>({});
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const adminStats = (() => {
    let total = 0, sinStock = 0, conDescuento = 0, valorTotal = 0;
    productos.forEach(p => {
      total++;
      if (p.stock === 0) sinStock++;
      if (p.descuento && p.descuento > 0) conDescuento++;
      valorTotal += p.precio * (p.stock ?? 10) * (1 - (p.descuento ?? 0) / 100);
    });
    return { total, sinStock, conDescuento, valorTotal: Math.round(valorTotal) };
  })();

  const handleAgotarTodo = async () => {
    if (!confirm('¿Estás seguro de que quieres poner en 0 el stock de TODOS los productos?')) return;
    setBulkLoading('agotar');
    try {
      await bulkUpdateStock(0);
      toast.success('Stock actualizado a 0 para todos los productos.');
    } catch (e) {
      toast.error('Error al agotar inventario');
    }
    setBulkLoading(null);
  };

  const handleRestaurarStock = async () => {
    if (!confirm('¿Estás seguro de que quieres poner 10 de stock a TODOS los productos?')) return;
    setBulkLoading('restaurar');
    try {
      await bulkUpdateStock(10);
      toast.success('Stock restaurado a 10 para todos los productos.');
    } catch (e) {
      toast.error('Error al restaurar inventario');
    }
    setBulkLoading(null);
  };

  const handleApplyCategoryDiscount = async (cat: string) => {
    const d = catDiscounts[cat];
    if (d === '' || d === undefined) return;
    setBulkLoading(`discount-${cat}`);
    try {
      await bulkCategoryDiscount(cat, Number(d));
      toast.success(`Descuento de ${d}% aplicado a la categoría ${cat}.`);
    } catch (e) {
      toast.error(`Error al aplicar descuento a ${cat}`);
    }
    setBulkLoading(null);
  };

  // Sincronizar inputs al abrir el modal o cambiar datos
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNumInput(whatsappNumber);
      setUserInput(username || '');
    }
  }, [whatsappNumber, username, isOpen]);

  const avataresPredeterminados = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jack',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Buster',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Midnight',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
  ];

  const handleSelectDefaultAvatar = async (url: string) => {
    setSubiendoAvatar(true);
    try {
      await actualizarAvatar(url);
      toast.success("¡Avatar actualizado con éxito!");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "No se pudo cambiar el avatar.";
      toast.error("Error al actualizar avatar", {
        description: errorMsg,
      });
    } finally {
      setSubiendoAvatar(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error("Archivo no válido", {
        description: "Por favor, selecciona una imagen (PNG, JPG, WEBP).",
      });
      return;
    }

    // Validar tamaño máximo (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Archivo muy grande", {
        description: "El tamaño máximo permitido es de 2 MB.",
      });
      return;
    }

    setSubiendoAvatar(true);
    try {
      await subirAvatar(file);
      toast.success("¡Imagen de perfil subida!", {
        description: "Tu avatar se ha actualizado correctamente.",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Ocurrió un error al subir el archivo.";
      toast.error("Error al subir imagen", {
        description: errorMsg,
      });
    } finally {
      setSubiendoAvatar(false);
    }
  };

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Es posible que el nombre de usuario ya esté registrado.";
      toast.error("Error al actualizar username", {
        description: errorMsg,
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6" data-lenis-prevent>

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
                      onClick={() => setSettings({ currency: moneda as 'COP' | 'USD' | 'MXN' })}
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
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-4 bg-themeInput/30 p-4 rounded-2xl border border-themeBorder/60 relative overflow-hidden group">
                <div className="relative w-12 h-12 rounded-xl bg-themeAccent/10 p-0.5 border border-themeBorder overflow-hidden flex items-center justify-center shrink-0">
                  {subiendoAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <Loader2 className="w-4 h-4 text-themeAccent animate-spin" />
                    </div>
                  )}
                  <img 
                    src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-themeTextMuted font-bold uppercase tracking-wider">{role || 'Usuario'}</p>
                  <p className="text-sm font-black text-themeText truncate">@{username || 'sin_username'}</p>
                  <p className="text-[11px] text-themeTextMuted truncate mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Sección de Edición de Avatar */}
              <section className="border-t border-themeBorder/40 pt-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-themeText uppercase tracking-widest">Imagen de Perfil</h3>
                  <span className="text-[10px] bg-themeAccent/10 text-themeAccent px-2 py-0.5 rounded font-bold uppercase tracking-wider">Avatar</span>
                </div>

                {/* Subir archivo local */}
                <div className="space-y-2">
                  <input
                    type="file"
                    id="upload-avatar-file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={subiendoAvatar}
                  />
                  <label
                    htmlFor="upload-avatar-file"
                    className={`flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed border-themeBorder hover:border-themeAccent/50 rounded-xl cursor-pointer bg-themeInput/10 hover:bg-themeAccent/5 transition-all text-xs font-bold text-themeTextMuted hover:text-themeText ${subiendoAvatar ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {subiendoAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin text-themeAccent" />
                    ) : (
                      <Upload className="w-4 h-4 text-themeAccent" />
                    )}
                    {subiendoAvatar ? 'Subiendo imagen...' : 'Subir imagen de tu PC (Max 2MB)'}
                  </label>
                </div>

                {/* Grid de 6 avatares predeterminados */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-themeTextMuted uppercase tracking-wider">O elige un avatar predeterminado:</p>
                  <div className="grid grid-cols-6 gap-2">
                    {avataresPredeterminados.map((url, idx) => {
                      const isSelected = avatarUrl === url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectDefaultAvatar(url)}
                          disabled={subiendoAvatar}
                          className={`aspect-square rounded-xl overflow-hidden bg-themeInput/25 border-2 p-1.5 transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isSelected ? 'border-themeAccent bg-themeAccent/10' : 'border-themeBorder hover:border-themeAccent/40'}`}
                          title={`Avatar predeterminado ${idx + 1}`}
                        >
                          <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

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
                  <h4 className="text-xs font-black uppercase tracking-wider">PANEL DE CONTROL</h4>
                  <p className="text-[10px] font-medium leading-relaxed mt-1">
                    Control total de NEXUS//CORE. Gestión de inventario, descuentos y configuración de la tienda.
                  </p>
                </div>
              </div>

              {/* ESTADÍSTICAS DEL INVENTARIO */}
              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">Estado del Inventario</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-themeInput/30 border border-themeBorder/60 p-3.5 rounded-2xl text-center">
                    <p className="text-2xl font-black text-themeAccent">{adminStats.total}</p>
                    <p className="text-[9px] font-bold text-themeTextMuted uppercase tracking-wider mt-1">Productos</p>
                  </div>
                  <div className="bg-themeInput/30 border border-themeBorder/60 p-3.5 rounded-2xl text-center">
                    <p className={`text-2xl font-black ${adminStats.sinStock > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{adminStats.sinStock}</p>
                    <p className="text-[9px] font-bold text-themeTextMuted uppercase tracking-wider mt-1">Sin Stock</p>
                  </div>
                  <div className="bg-themeInput/30 border border-themeBorder/60 p-3.5 rounded-2xl text-center">
                    <p className="text-2xl font-black text-emerald-500">{adminStats.conDescuento}</p>
                    <p className="text-[9px] font-bold text-themeTextMuted uppercase tracking-wider mt-1">En Oferta</p>
                  </div>
                </div>
                <div className="mt-3 bg-themeInput/30 border border-themeBorder/60 p-4 rounded-2xl">
                  <p className="text-[9px] font-bold text-themeTextMuted uppercase tracking-wider">Valor Total del Inventario</p>
                  <p className="text-xl font-black text-themeText mt-1">${adminStats.valorTotal.toLocaleString()} <span className="text-xs text-themeTextMuted">COP</span></p>
                </div>
              </section>

              {/* WHATSAPP */}
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
                    className="bg-themeAccent hover:bg-themeAccentHover text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-themeAccent/10"
                  >
                    Guardar
                  </button>
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2">Código de país + número sin espacios.</p>
              </section>

              {/* DESCUENTOS POR CATEGORÍA */}
              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">Descuento por Categoría</h3>
                <div className="space-y-3">
                  {['Componentes', 'Periféricos'].map((cat) => (
                    <div key={cat} className="flex items-center gap-3 bg-themeInput/30 border border-themeBorder/60 p-3.5 rounded-2xl">
                      <span className="text-xs font-black text-themeText flex-1">{cat}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0" max="99"
                          placeholder="0"
                          value={catDiscounts[cat] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setCatDiscounts(prev => ({ ...prev, [cat]: '' }));
                            } else {
                              const num = parseInt(val, 10);
                              if (!isNaN(num)) {
                                setCatDiscounts(prev => ({ ...prev, [cat]: Math.min(99, Math.max(0, num)) }));
                              }
                            }
                          }}
                          className="w-16 px-3 py-2 bg-themeInput border border-themeBorder rounded-xl text-themeText text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                        />
                        <span className="text-xs text-themeTextMuted font-black">%</span>
                        <button
                          onClick={() => handleApplyCategoryDiscount(cat)}
                          disabled={bulkLoading !== null}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 disabled:opacity-50"
                        >
                          {bulkLoading === `discount-${cat}` ? <Loader2 size={12} className="animate-spin" /> : 'Aplicar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2">Aplica un % de descuento a todos los productos de una categoría.</p>
              </section>

              {/* ACCIONES MASIVAS */}
              <section className="border-t border-themeBorder/40 pt-5">
                <h3 className="text-xs font-black text-themeText uppercase tracking-widest mb-3">Acciones Rápidas</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleAgotarTodo}
                    disabled={bulkLoading !== null}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 p-4 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
                  >
                    {bulkLoading === 'agotar' ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                    Agotar Todo
                  </button>
                  <button
                    onClick={handleRestaurarStock}
                    disabled={bulkLoading !== null}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 p-4 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
                  >
                    {bulkLoading === 'restaurar' ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                    Restaurar (10 uds)
                  </button>
                </div>
                <p className="text-[10px] text-themeTextMuted mt-2">Modifica el stock de TODOS los productos a la vez.</p>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}