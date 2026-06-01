import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProductos } from '../hooks/useProductos';
import { useCarrito, type Producto } from '../hooks/useCarrito';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { convertPrice, formatCurrency } from '../utils/currency';
import { Star, ShoppingCart, ArrowLeft, ZoomIn, X, Send, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewItem {
  id: number;
  puntuacion: number;
  comentario: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string;
  } | null;
}

export default function PaginaProducto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchProductoById } = useProductos();
  const agregarProducto = useCarrito((state) => state.agregarProducto);
  const { currency, rates } = useSettings();
  const { user, username, avatarUrl } = useAuth();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [resenas, setResenas] = useState<ReviewItem[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados de galería
  const [imagenActiva, setImagenActiva] = useState('');
  const [zoomAbierto, setZoomAbierto] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  // Estados de compra
  const [cantidad, setCantidad] = useState(1);
  const [estaAgregando, setEstaAgregando] = useState(false);

  // Estados de formulario de reseña
  const [nuevaPuntuacion, setNuevaPuntuacion] = useState(5);
  const [hoverPuntuacion, setHoverPuntuacion] = useState(0);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoResena, setEnviandoResena] = useState(false);

  // Estados del modal interactivo
  const [modalZoomed, setModalZoomed] = useState(false);
  const [modalZoomPos, setModalZoomPos] = useState({ x: 50, y: 50 });

  const imagenesArray = producto?.imagenes && producto.imagenes.length > 0
    ? producto.imagenes.map(img => img.url)
    : producto ? [producto.imagen] : [];

  const currentIdx = imagenesArray.indexOf(imagenActiva) !== -1 ? imagenesArray.indexOf(imagenActiva) : 0;

  const handleModalMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!modalZoomed) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setModalZoomPos({ x, y });
  };

  const prevImage = () => {
    if (imagenesArray.length <= 1) return;
    const newIdx = (currentIdx - 1 + imagenesArray.length) % imagenesArray.length;
    setImagenActiva(imagenesArray[newIdx]);
    setModalZoomed(false);
    setModalZoomPos({ x: 50, y: 50 });
  };

  const nextImage = () => {
    if (imagenesArray.length <= 1) return;
    const newIdx = (currentIdx + 1) % imagenesArray.length;
    setImagenActiva(imagenesArray[newIdx]);
    setModalZoomed(false);
    setModalZoomPos({ x: 50, y: 50 });
  };

  useEffect(() => {
    async function cargarDetalles() {
      if (!id) return;
      setCargando(true);

      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));

      try {
        const res = await Promise.race([fetchProductoById(Number(id)), timeout]);
        if (res && res.producto) {
          setProducto(res.producto);
          setResenas(res.resenas);
          setImagenActiva(res.producto.imagen);
        } else {
          toast.error("Producto no encontrado o tiempo de espera agotado");
          navigate('/');
        }
      } catch {
        toast.error("Error al cargar el producto");
        navigate('/');
      }
      setCargando(false);
    }
    cargarDetalles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!zoomAbierto || !producto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomAbierto(false);
        setModalZoomed(false);
      }
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomAbierto, currentIdx, imagenesArray, producto]);

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (zoomAbierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [zoomAbierto]);

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-themeAccent">
        <div className="w-12 h-12 border-4 border-t-themeAccent border-themeBorder rounded-full animate-spin mb-4"></div>
        <p className="text-themeTextMuted font-bold animate-pulse uppercase tracking-wider text-xs">Cargando detalles del hardware...</p>
      </div>
    );
  }

  if (!producto) return null;

  const precioConvertido = convertPrice(producto.precio, currency, rates);
  const precioFormateado = formatCurrency(precioConvertido, currency);

  const stockDisponible = producto.stock ?? 10;
  const sinStock = stockDisponible === 0;

  // Calcular puntuación promedio
  const totalPuntos = resenas.reduce((sum, res) => sum + res.puntuacion, 0);
  const promedioPuntuacion = resenas.length > 0 ? (totalPuntos / resenas.length).toFixed(1) : 'Nuevo';

  const handleAgregar = () => {
    if (sinStock) return;
    agregarProducto(producto, cantidad);
    toast.success(`Añadido: ${cantidad}x ${producto.nombre} al carrito`);
    setEstaAgregando(true);
    setTimeout(() => setEstaAgregando(false), 1000);
  };

  const handleEnviarResena = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Debes iniciar sesión para escribir una reseña");
      return;
    }
    if (!nuevoComentario || nuevoComentario.trim().length < 5) {
      toast.error("Comentario muy corto", { description: "Escribe al menos 5 letras." });
      return;
    }
    if (!nuevaPuntuacion || nuevaPuntuacion < 1 || nuevaPuntuacion > 5) {
      toast.error("Selecciona una calificación válida", { description: "Elige entre 1 y 5 estrellas." });
      return;
    }
    if (!producto) return;

    setEnviandoResena(true);

    const puntuacionFinal = nuevaPuntuacion;
    const comentarioFinal = nuevoComentario.trim();

    try {
      // 1. Intentar insertar en Supabase
      const { data, error } = await supabase
        .from('resenas')
        .insert({
          producto_id: producto.id,
          user_id: user.id,
          puntuacion: puntuacionFinal,
          comentario: comentarioFinal,
        })
        .select('id, puntuacion, comentario, created_at')
        .maybeSingle();

      if (error) throw error;

      // Armar la nueva reseña localmente para visualizarla de inmediato
      const reviewAgregada: ReviewItem = {
        id: data?.id ?? Date.now(),
        puntuacion: puntuacionFinal,
        comentario: comentarioFinal,
        created_at: data?.created_at ?? new Date().toISOString(),
        profiles: {
          username: username || user.email?.split('@')[0] || 'yo',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
        }
      };

      setResenas(prev => [reviewAgregada, ...prev]);
      setNuevoComentario('');
      setNuevaPuntuacion(5);
      setHoverPuntuacion(0);
      toast.success("¡Reseña publicada con éxito!", {
        description: "Gracias por valorar este producto."
      });

    } catch (err) {
      console.error("Error al publicar reseña en Supabase:", err);
      const errorMsg = err instanceof Error ? err.message : 'Error al conectar con la base de datos';
      toast.error("No se pudo guardar tu reseña", {
        description: errorMsg
      });
    } finally {
      setEnviandoResena(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 animate-fade-in text-themeText">
      
      {/* 🔙 Botón Volver & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-themeBorder/40 pb-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-themeTextMuted hover:text-themeAccent transition-colors uppercase tracking-wider"
        >
          <ArrowLeft size={16} />
          Volver a la tienda
        </Link>
        
        <div className="flex items-center gap-1.5 text-xs text-themeTextMuted font-bold uppercase tracking-wider">
          <Link to="/" className="hover:text-themeAccent">Inicio</Link>
          <span>/</span>
          <span>{producto.categoria}</span>
          <span>/</span>
          <span className="text-themeAccent truncate max-w-[150px]">{producto.nombre}</span>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* 📸 SECCIÓN IZQUIERDA: GALERÍA DE IMÁGENES */}
        <div className="md:col-span-6 space-y-4">
          
          {/* Foto Principal */}
          <div 
            className="relative group aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] backdrop-blur-xl cursor-zoom-in transition-all duration-500 hover:border-white/20 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              setIsHovered(false);
              setZoomPos({ x: 50, y: 50 });
            }}
            onMouseMove={handleMouseMove}
            onClick={() => setZoomAbierto(true)}
          >
            <img 
              src={imagenActiva} 
              alt={producto.nombre} 
              style={{
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transform: isHovered ? 'scale(2.2)' : 'scale(1)'
              }}
              className="w-full h-full object-contain p-4 transition-transform duration-300 ease-out drop-shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=Hardware';
              }}
            />
            {isHovered && (
              <div 
                className="absolute pointer-events-none border-2 border-themeAccent rounded-full w-28 h-28 shadow-lg shadow-themeAccent/20 bg-themeAccent/5 backdrop-blur-[0.5px]"
                style={{
                  left: `${zoomPos.x}%`,
                  top: `${zoomPos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setZoomAbierto(true);
              }}
              className="absolute bottom-4 right-4 bg-themeCard/90 hover:bg-themeCard text-themeText p-2 rounded-xl border border-themeBorder/60 shadow-lg backdrop-blur-sm transition-all active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
            >
              <ZoomIn size={14} className="text-themeAccent" />
              Zoom
            </button>
          </div>

          {/* Galería de miniaturas (Thumbnails) */}
          {producto.imagenes && producto.imagenes.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {producto.imagenes.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setImagenActiva(img.url)}
                  className={`relative w-20 aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-themeInput/30 ${imagenActiva === img.url ? 'border-themeAccent shadow-sm scale-98' : 'border-themeBorder hover:border-themeAccent/40'}`}
                >
                  <img src={img.url} alt="Miniatura" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 📝 SECCIÓN DERECHA: INFORMACIÓN Y ACCIONES */}
        <div className="md:col-span-6 space-y-6">
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-themeAccent/10 border border-themeAccent/20 text-themeAccent text-[9px] font-black uppercase tracking-widest rounded-full">
              {producto.marca || 'NEXUS'}
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              {producto.nombre}
            </h1>
            
            {/* Valoraciones y Reseñas */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center text-amber-500">
                <Star size={16} className="fill-current" />
                <span className="font-black ml-1 text-themeText">{promedioPuntuacion}</span>
              </div>
              <span className="text-themeBorder h-3 w-[1px] bg-current opacity-40" />
              <span className="text-themeTextMuted font-bold">{resenas.length} reseñas publicadas</span>
            </div>
          </div>

          {/* Precio y Estado del Stock */}
          <div className="bg-themeInput/30 border border-themeBorder/60 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-themeTextMuted font-bold uppercase tracking-wider">Precio del hardware</p>
                <p className="text-2xl md:text-3xl font-black text-themeAccent mt-0.5">{precioFormateado}</p>
              </div>
              
              <div>
                {sinStock ? (
                  <span className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg">
                    Agotado
                  </span>
                ) : stockDisponible <= 3 ? (
                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg animate-pulse">
                    ¡Últimas {stockDisponible} uds!
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg">
                    En Stock ({stockDisponible})
                  </span>
                )}
              </div>
            </div>

            {/* Controles de Compra */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              
              {/* Contador de unidades */}
              <div className="flex items-center justify-between border border-themeBorder rounded-xl bg-themeCard p-1 sm:w-32">
                <button
                  onClick={() => cantidad > 1 && setCantidad(cantidad - 1)}
                  disabled={sinStock}
                  className="px-3 py-1.5 font-bold hover:text-themeAccent disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="font-bold text-sm">{sinStock ? 0 : cantidad}</span>
                <button
                  onClick={() => cantidad < stockDisponible ? setCantidad(cantidad + 1) : toast.warning("Límite de stock")}
                  disabled={sinStock}
                  className="px-3 py-1.5 font-bold hover:text-themeAccent disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>

              {/* Botón de compra */}
              <button
                onClick={handleAgregar}
                disabled={sinStock || estaAgregando}
                className={`flex-1 flex items-center justify-center gap-2 font-black py-3 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] ${sinStock ? 'bg-themeBorder text-themeTextMuted cursor-not-allowed' : estaAgregando ? 'bg-emerald-600 text-white' : 'bg-themeAccent hover:bg-themeAccentHover text-white shadow-themeAccent/15'}`}
              >
                <ShoppingCart size={18} />
                {sinStock ? "Sin Stock disponible" : estaAgregando ? "¡Añadido! ✓" : "Agregar al carrito"}
              </button>
            </div>
          </div>

          {/* Descripción corta */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-themeText">Descripción Breve</h3>
            <p className="text-sm text-themeTextMuted leading-relaxed">
              {producto.descripcion}
            </p>
          </div>
        </div>
      </div>

      {/* 📑 FICHA TÉCNICA Y DESCRIPCIÓN DETALLADA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-themeBorder/40 pt-8">
        
        {/* Descripción Detallada */}
        <div className="lg:col-span-6 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-themeText">Descripción Detallada</h3>
          <p className="text-sm text-themeTextMuted leading-relaxed whitespace-pre-line bg-themeInput/15 p-5 rounded-2xl border border-themeBorder/40">
            {producto.descripcion_larga || "No se ha proporcionado una descripción extendida para este producto."}
          </p>
        </div>

        {/* Ficha de Especificaciones */}
        <div className="lg:col-span-6 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-themeText">Ficha Técnica</h3>
          <div className="border border-themeBorder rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <tbody>
                {producto.especificaciones ? (
                  Object.entries(producto.especificaciones).map(([key, value], idx) => (
                    <tr 
                      key={key} 
                      className={`border-b border-themeBorder/60 last:border-none ${idx % 2 === 0 ? 'bg-themeInput/20' : 'bg-themeCard'}`}
                    >
                      <td className="px-4 py-3 font-bold text-themeText w-1/3 border-r border-themeBorder/40">{key}</td>
                      <td className="px-4 py-3 text-themeTextMuted">{value}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-center text-themeTextMuted">No hay especificaciones listadas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 💬 SECCIÓN DE RESEÑAS Y VALORACIONES */}
      <div className="border-t border-themeBorder/40 pt-8 space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-themeText">Reseñas de la comunidad ({resenas.length})</h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Formulario de Nueva Reseña */}
          <div className="lg:col-span-5 bg-themeInput/30 border border-themeBorder/60 p-6 rounded-2xl space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-themeText">Deja tu valoración</h4>
            
            {user ? (
              <form onSubmit={handleEnviarResena} className="space-y-4">
                
                {/* Selector de Estrellas */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-themeTextMuted font-bold uppercase tracking-wider">Calificación</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNuevaPuntuacion(star);
                        }}
                        onMouseEnter={() => setHoverPuntuacion(star)}
                        onMouseLeave={() => setHoverPuntuacion(0)}
                        className={`p-1.5 transition-all duration-150 rounded-lg hover:scale-110 active:scale-95 cursor-pointer ${
                          star <= (hoverPuntuacion || nuevaPuntuacion) 
                            ? 'text-amber-500 hover:bg-amber-500/10' 
                            : 'text-themeTextMuted/30 hover:text-amber-400/60 hover:bg-themeInput/30'
                        }`}
                      >
                        <Star size={26} className="fill-current" />
                      </button>
                    ))}
                    <span className="ml-2 self-center text-xs font-bold text-themeTextMuted">
                      {hoverPuntuacion || nuevaPuntuacion}/5
                    </span>
                  </div>
                </div>

                {/* Comentario de reseña */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-themeTextMuted font-bold uppercase tracking-wider">Comentario</label>
                  <textarea
                    rows={4}
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Cuéntanos tu experiencia con este componente..."
                    className="w-full px-4 py-3 bg-themeCard border border-themeBorder rounded-xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent transition-all placeholder-themeTextMuted/40 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviandoResena}
                  className="w-full flex items-center justify-center gap-2 bg-themeAccent hover:bg-themeAccentHover text-white font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-themeAccent/15"
                >
                  <Send size={14} />
                  {enviandoResena ? "Publicando..." : "Publicar reseña"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-3">
                <AlertCircle className="w-10 h-10 text-themeTextMuted mx-auto stroke-[1.5] opacity-50" />
                <p className="text-xs text-themeTextMuted font-medium">Inicia sesión con tu cuenta para dejar tu reseña.</p>
                <Link
                  to="/login"
                  className="inline-block bg-themeAccent hover:bg-themeAccentHover text-white text-xs font-black py-2 px-4 rounded-xl transition-all shadow-md shadow-themeAccent/10"
                >
                  Iniciar sesión
                </Link>
              </div>
            )}
          </div>

          {/* Listado de Reseñas */}
          <div className="lg:col-span-7 space-y-4">
            {resenas.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-themeBorder rounded-2xl">
                <p className="text-xs text-themeTextMuted font-bold uppercase tracking-wider">Sin valoraciones todavía</p>
                <p className="text-[11px] text-themeTextMuted/70 mt-1">Sé el primero en valorar este hardware.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {resenas.map((res) => {
                  const FAKE_USERNAMES = ["nexus_builder", "kiev_gamer", "tech_ninja", "rgb_lover", "fps_hunter", "pc_master", "hardware_guru", "cyber_punk", "pixel_perfect", "silicon_fan"];
                  const displayUsername = res.profiles?.username || `${FAKE_USERNAMES[res.id % FAKE_USERNAMES.length]}_${(res.id % 89) + 10}`;
                  
                  return (
                    <div 
                      key={res.id} 
                      className="p-5 bg-themeCard border border-themeBorder/70 rounded-2xl space-y-3 shadow-sm transition-all hover:border-themeBorder"
                    >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={res.profiles?.avatar_url && res.profiles.avatar_url !== 'null' ? res.profiles.avatar_url : `https://api.dicebear.com/7.x/bottts/svg?seed=${res.id}`} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-lg bg-themeInput p-0.5 border border-themeBorder/40"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${res.id}`;
                          }}
                        />
                        <div>
                          <p className="text-xs font-black text-themeText">@{displayUsername}</p>
                          <div className="flex text-amber-500 mt-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                size={10} 
                                className={`fill-current ${s <= res.puntuacion ? '' : 'opacity-20'}`} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-themeTextMuted font-bold uppercase tracking-wider">
                        <Calendar size={10} />
                        {new Date(res.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-themeTextMuted leading-relaxed bg-themeInput/10 p-3.5 rounded-xl italic">
                      "{res.comentario}"
                    </p>
                  </div>
                );
              })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 🖼️ INTERACTIVE LIGHTBOX / GALLERY MODAL (PUNTO 1) */}
      {zoomAbierto && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-2xl flex flex-col items-center justify-between p-4 animate-fade-in"
          onClick={() => {
            setZoomAbierto(false);
            setModalZoomed(false);
          }}
        >
          {/* Cabecera del modal */}
          <div className="w-full flex items-center justify-between px-4 py-2 z-10 shrink-0">
            <span className="text-xs font-black uppercase tracking-widest text-white/60">
              {producto.nombre} ({currentIdx + 1} / {imagenesArray.length})
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider hidden sm:block">
                {modalZoomed ? 'Mover ratón para explorar · Clic para salir del zoom' : 'Clic en imagen para zoom · Esc para cerrar'}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomAbierto(false);
                  setModalZoomed(false);
                }}
                className="text-white/70 hover:text-red-400 p-2 hover:bg-white/10 rounded-full transition-all active:scale-95"
                title="Cerrar (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Área principal: Imagen + Botones laterales */}
          <div className="flex-1 flex items-center justify-center relative w-full max-w-5xl mx-auto min-h-0">
            {/* Botón Izquierda */}
            {imagenesArray.length > 1 && !modalZoomed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-2 sm:left-4 z-20 bg-black/40 border border-white/10 hover:bg-white/15 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-90 hover:border-white/30"
                title="Imagen Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Contenedor de la Imagen con Zoom — overflow hidden estricto */}
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl min-h-[300px]"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={imagenActiva.replace('&w=600', '&w=1600')} 
                alt={producto.nombre} 
                draggable={false}
                onClick={() => {
                  setModalZoomed(!modalZoomed);
                  if (modalZoomed) setModalZoomPos({ x: 50, y: 50 });
                }}
                onMouseMove={handleModalMouseMove}
                onMouseLeave={() => {
                  if (modalZoomed) setModalZoomPos({ x: 50, y: 50 });
                }}
                style={{
                  transformOrigin: modalZoomed ? `${modalZoomPos.x}% ${modalZoomPos.y}%` : 'center center',
                }}
                className={`w-full h-full object-contain select-none transition-transform duration-300 ease-out ${
                  modalZoomed 
                    ? 'scale-[2.5] cursor-grab active:cursor-grabbing' 
                    : 'scale-100 cursor-zoom-in hover:scale-[1.02] drop-shadow-2xl'
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=Hardware';
                }}
              />
              {/* Indicador de zoom activo */}
              {modalZoomed && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white/70 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full pointer-events-none border border-white/10">
                  Zoom 1.5× · Mover ratón para explorar
                </div>
              )}
            </div>

            {/* Botón Derecha */}
            {imagenesArray.length > 1 && !modalZoomed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-2 sm:right-4 z-20 bg-black/40 border border-white/10 hover:bg-white/15 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-90 hover:border-white/30"
                title="Siguiente Imagen"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Miniaturas al pie del modal */}
          {imagenesArray.length > 1 && (
            <div className="w-full py-3 flex justify-center gap-2.5 z-10 shrink-0" onClick={(e) => e.stopPropagation()}>
              {imagenesArray.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setImagenActiva(url);
                    setModalZoomed(false);
                    setModalZoomPos({ x: 50, y: 50 });
                  }}
                  className={`relative w-14 h-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                    idx === currentIdx 
                      ? 'border-themeAccent shadow-lg shadow-themeAccent/20 scale-110' 
                      : 'border-white/10 hover:border-white/40 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={url.replace('&w=1600', '&w=600')} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
