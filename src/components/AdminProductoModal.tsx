import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Save, AlertTriangle, ImagePlus, Cpu, Tag, DollarSign, Package, FileText, Image as ImageIcon, Percent, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { Producto } from '../types';
import { useProductosStore } from '../hooks/useProductos';

interface AdminProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  productoAEditar?: Producto | null;
}

interface SpecItem {
  key: string;
  value: string;
}

interface StagedImage {
  url: string;
  markedForDeletion: boolean;
}

export default function AdminProductoModal({ isOpen, onClose, productoAEditar }: AdminProductoModalProps) {
  const agregarProductoStore = useProductosStore((s) => s.agregarProductoStore);
  const actualizarProductoStore = useProductosStore((s) => s.actualizarProductoStore);
  const eliminarProductoStore = useProductosStore((s) => s.eliminarProductoStore);
  const [cargando, setCargando] = useState(false);
  const [mostrarConfirmarEliminar, setMostrarConfirmarEliminar] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Estados del formulario
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [imagen, setImagen] = useState('');
  const [imagenPrincipalMarcadaEliminar, setImagenPrincipalMarcadaEliminar] = useState(false);
  const [categoria, setCategoria] = useState('Componentes');
  const [marca, setMarca] = useState('');
  const [stock, setStock] = useState<number | ''>(10);
  const [descuento, setDescuento] = useState<number | ''>(0);
  const [descripcion, setDescripcion] = useState('');
  const [descripcionLarga, setDescripcionLarga] = useState('');
  
  const [imagenesAdicionales, setImagenesAdicionales] = useState<StagedImage[]>([]);
  const [nuevaImgUrl, setNuevaImgUrl] = useState('');

  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [nuevaSpecKey, setNuevaSpecKey] = useState('');
  const [nuevaSpecValue, setNuevaSpecValue] = useState('');

  // Cierre animado
  const handleClose = useCallback(() => {
    if (cargando) return;
    setCerrando(true);
    setTimeout(() => {
      setCerrando(false);
      onClose();
    }, 300);
  }, [cargando, onClose]);

  // Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Cargar datos
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrarConfirmarEliminar(false);
      setImagenPrincipalMarcadaEliminar(false);
      if (productoAEditar) {
        setNombre(productoAEditar.nombre || '');
        setPrecio(productoAEditar.precio || 0);
        setImagen(productoAEditar.imagen || '');
        setCategoria(productoAEditar.categoria || 'Componentes');
        setMarca(productoAEditar.marca || '');
        setStock(productoAEditar.stock ?? 10);
        setDescuento(productoAEditar.descuento ?? 0);
        setDescripcion(productoAEditar.descripcion || '');
        setDescripcionLarga(productoAEditar.descripcion_larga || '');
        
        const imgs = productoAEditar.imagenes 
          ? productoAEditar.imagenes
              .map(img => img.url)
              .filter(Boolean)
              .map(url => ({ url, markedForDeletion: false }))
          : [];
        setImagenesAdicionales(imgs);
        
        if (productoAEditar.especificaciones) {
          const specList = Object.entries(productoAEditar.especificaciones).map(([key, value]) => ({
            key,
            value: String(value)
          }));
          setSpecs(specList);
        } else {
          setSpecs([]);
        }
      } else {
        setNombre('');
        setPrecio('');
        setImagen('');
        setCategoria('Componentes');
        setMarca('');
        setStock(10);
        setDescuento(0);
        setDescripcion('');
        setDescripcionLarga('');
        setImagenesAdicionales([]);
        setSpecs([]);
      }
      setNuevaImgUrl('');
      setNuevaSpecKey('');
      setNuevaSpecValue('');
      setTimeout(() => formRef.current?.scrollTo({ top: 0, behavior: 'instant' }), 50);
    }
  }, [productoAEditar, isOpen]);

  const agregarImagenAdicional = () => {
    const cleanUrl = nuevaImgUrl.trim();
    if (!cleanUrl) return;
    const existingIdx = imagenesAdicionales.findIndex(item => item.url === cleanUrl);
    if (existingIdx !== -1) {
      if (imagenesAdicionales[existingIdx].markedForDeletion) {
        setImagenesAdicionales(prev =>
          prev.map((item, idx) => idx === existingIdx ? { ...item, markedForDeletion: false } : item)
        );
        setNuevaImgUrl('');
        toast.info("Imagen restaurada en la galería.");
        return;
      }
      toast.warning("La URL de la imagen ya está agregada.");
      return;
    }
    setImagenesAdicionales([...imagenesAdicionales, { url: cleanUrl, markedForDeletion: false }]);
    setNuevaImgUrl('');
  };

  // Manejo en memoria/staging: marcar o restaurar sin mutar BD hasta Guardar Cambios
  const toggleEliminarImagenAdicional = (idx: number) => {
    setImagenesAdicionales(prev =>
      prev.map((item, i) => i === idx ? { ...item, markedForDeletion: !item.markedForDeletion } : item)
    );
  };

  const agregarSpec = () => {
    if (!nuevaSpecKey.trim() || !nuevaSpecValue.trim()) {
      toast.warning("Falta la clave o el valor.");
      return;
    }
    if (specs.some(s => s.key.toLowerCase() === nuevaSpecKey.trim().toLowerCase())) {
      toast.warning("La especificación ya existe.");
      return;
    }
    setSpecs([...specs, { key: nuevaSpecKey.trim(), value: nuevaSpecValue.trim() }]);
    setNuevaSpecKey('');
    setNuevaSpecValue('');
  };

  const eliminarSpec = (key: string) => {
    setSpecs(specs.filter(s => s.key !== key));
  };

  // Guardar cambios con validación detallada
  const handleGuardar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const imagenesActivas = imagenesAdicionales
      .filter(img => !img.markedForDeletion)
      .map(img => img.url);

    // Si la imagen principal fue marcada para eliminar, usar la primera activa de la galería si existe
    const imagenPrincipalFinal = imagenPrincipalMarcadaEliminar
      ? (imagenesActivas[0] || '')
      : imagen.trim();

    if (!nombre.trim()) return toast.error("El nombre del producto es obligatorio.");
    if (!marca.trim()) return toast.error("La marca es obligatoria.");
    if (precio === '' || precio < 0) return toast.error("Ingresa un precio válido mayor o igual a 0.");
    if (stock === '' || stock < 0) return toast.error("Ingresa un stock válido mayor o igual a 0.");
    if (!imagenPrincipalFinal) return toast.error("El producto requiere una imagen principal activa (restaura la actual o ingresa una nueva URL).");
    if (!descripcion.trim()) return toast.error("La descripción corta es obligatoria.");

    setCargando(true);

    const especificacionesObj: Record<string, string> = {};
    specs.forEach(s => { especificacionesObj[s.key] = s.value; });

    // Verificar si las imágenes realmente cambiaron respecto al estado original en BD
    let imagenesCambiaron = true;
    if (productoAEditar) {
      const imgsOriginales = productoAEditar.imagenes ? productoAEditar.imagenes.map(img => img.url).filter(Boolean) : [];
      if (imgsOriginales.length === imagenesActivas.length) {
        const sonIguales = imgsOriginales.every((url, idx) => url === imagenesActivas[idx]);
        if (sonIguales) {
          imagenesCambiaron = false;
        }
      }
    }

    const imagenesFormateadas = imagenesActivas.map((url, idx) => ({
      id: 0, url, orden: idx
    }));

    const datosProducto = {
      nombre: nombre.trim(),
      precio: Number(precio),
      imagen: imagenPrincipalFinal,
      categoria,
      marca: marca.trim(),
      stock: Number(stock),
      descuento: Number(descuento) || 0,
      descripcion: descripcion.trim(),
      descripcion_larga: descripcionLarga.trim() || undefined,
      especificaciones: Object.keys(especificacionesObj).length > 0 ? especificacionesObj : undefined,
      ...(imagenesCambiaron && { imagenes: imagenesFormateadas })
    };

    try {
      if (productoAEditar) {
        await actualizarProductoStore(productoAEditar.id, datosProducto);
        toast.success("¡Producto actualizado exitosamente!");
      } else {
        await agregarProductoStore(datosProducto);
        toast.success("¡Nuevo producto agregado al catálogo!");
      }
      handleClose();
    } catch (err) {
      toast.error("Error crítico al guardar", {
        description: err instanceof Error ? err.message : "Por favor, verifica tu conexión e inténtalo de nuevo."
      });
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async () => {
    if (!productoAEditar) return;
    setCargando(true);
    try {
      await eliminarProductoStore(productoAEditar.id);
      toast.success("Producto eliminado permanentemente.");
      handleClose();
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setCargando(false);
      setMostrarConfirmarEliminar(false);
    }
  };

  if (!isOpen) return null;

  const backdropAnim = cerrando ? 'animate-backdrop-out' : 'animate-backdrop-in';
  const modalAnim = cerrando ? 'animate-modal-out scale-95 opacity-0' : 'animate-modal-in scale-100 opacity-100';
  const marcadasCount = imagenesAdicionales.filter(i => i.markedForDeletion).length + (imagenPrincipalMarcadaEliminar ? 1 : 0);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-themeBg transition-all duration-300 ${backdropAnim}`}
      onClick={handleClose}
      data-lenis-prevent="true"
    >
      <div 
        className={`relative w-full max-w-full h-full bg-themeBg shadow-2xl flex flex-col overflow-x-hidden overflow-y-hidden box-border transition-all duration-300 transform ${modalAnim}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO STICKY */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:p-6 bg-themeCard/90 backdrop-blur-xl border-b border-themeBorder/40 z-10 shrink-0 shadow-sm w-full max-w-full box-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-themeAccent/10 border border-themeAccent/20 flex items-center justify-center shadow-inner shrink-0">
              <Cpu size={20} className="text-themeAccent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black tracking-tight text-themeText uppercase truncate">
                {productoAEditar ? "Modificar Hardware" : "Nuevo Hardware"}
              </h2>
              <p className="text-[10px] sm:text-xs text-themeTextMuted font-bold uppercase tracking-widest mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>NEXUS // CORE</span>
                {productoAEditar && <span className="text-themeAccent bg-themeAccent/10 px-2 py-0.5 rounded-md">ID: {productoAEditar.id}</span>}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center text-themeTextMuted hover:text-white bg-themeInput/50 hover:bg-red-500/80 rounded-2xl transition-all duration-300 hover:rotate-90 hover:shadow-lg hover:shadow-red-500/20 active:scale-90"
            disabled={cargando}
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* CUERPO DEL MODAL (1 COLUMNA EN MÓVIL <768px, 2 COLUMNAS EN DESKTOP) */}
        <form 
          ref={formRef}
          id="admin-producto-form" 
          onSubmit={handleGuardar} 
          className="flex-1 w-full max-w-full box-border overflow-y-auto overflow-x-hidden custom-scrollbar p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 lg:gap-12 items-start"
        >
          
          {/* COLUMNA IZQUIERDA: Info Base y Precio */}
          <div className="w-full max-w-full min-w-0 flex flex-col gap-5 sm:gap-8 box-border">
            
            {/* Imagen Principal Prominente */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                  <ImageIcon size={14} /> Imagen Principal
                </div>
                {imagen && (
                  <button
                    type="button"
                    onClick={() => setImagenPrincipalMarcadaEliminar(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      imagenPrincipalMarcadaEliminar
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                    }`}
                  >
                    {imagenPrincipalMarcadaEliminar ? (
                      <>
                        <RotateCcw size={12} /> Restaurar
                      </>
                    ) : (
                      <>
                        <Trash2 size={12} /> Eliminar
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="relative aspect-video w-full max-w-full rounded-2xl overflow-hidden bg-themeInput border-2 border-dashed border-themeBorder/60 group box-border">
                {imagen ? (
                  <>
                    <img
                      src={imagen}
                      alt="Preview"
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        imagenPrincipalMarcadaEliminar ? 'opacity-30 grayscale' : 'group-hover:scale-105'
                      }`}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1e293b/475569?text=Error+en+URL'; }}
                    />
                    {imagenPrincipalMarcadaEliminar && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <span className="bg-red-500/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                          Marcada para eliminar
                        </span>
                        <button
                          type="button"
                          onClick={() => setImagenPrincipalMarcadaEliminar(false)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
                        >
                          <RotateCcw size={14} /> Restaurar imagen
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-themeTextMuted p-4 text-center">
                    <ImagePlus size={40} className="mb-3 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-wider">Sin imagen principal</p>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/80 to-transparent w-full box-border">
                  <input
                    type="url"
                    required={!imagenPrincipalMarcadaEliminar}
                    placeholder="URL de la imagen principal..."
                    value={imagen}
                    onChange={(e) => {
                      setImagen(e.target.value);
                      if (imagenPrincipalMarcadaEliminar) setImagenPrincipalMarcadaEliminar(false);
                    }}
                    className="w-full max-w-full box-border px-3.5 py-2.5 sm:px-4 sm:py-3 bg-themeCard/90 backdrop-blur-md border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/80 transition-all placeholder:text-themeTextMuted"
                  />
                </div>
              </div>
            </div>

            {/* Detalles Principales */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2 mb-1 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <Tag size={14} /> Identificación
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full box-border">
                <div className="md:col-span-2 min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AMD Ryzen 9 7950X3D"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full max-w-full box-border px-4 sm:px-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AMD"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="w-full max-w-full box-border px-4 sm:px-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Categoría *</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full max-w-full box-border px-4 sm:px-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all appearance-none"
                  >
                    <option value="Componentes">Componentes</option>
                    <option value="Periféricos">Periféricos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Comercial (Precio y Stock) */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2 mb-1 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <DollarSign size={14} /> Comercialización
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full max-w-full box-border">
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Precio (COP) *</label>
                  <div className="relative w-full max-w-full">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">$</span>
                    <input
                      type="number"
                      required min="0"
                      placeholder="0"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full max-w-full box-border pl-9 sm:pl-10 pr-4 sm:pr-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-themeCard focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Stock Físico *</label>
                  <div className="relative w-full max-w-full">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">
                      <Package size={16} />
                    </span>
                    <input
                      type="number"
                      min="0" required
                      placeholder="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className={`w-full max-w-full box-border pl-11 sm:pl-12 pr-4 sm:pr-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all ${stock === 0 ? 'text-red-500 focus:border-red-500 focus:ring-red-500/40' : ''}`}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Descuento %</label>
                  <div className="relative w-full max-w-full">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">
                      <Percent size={16} />
                    </span>
                    <input
                      type="number"
                      min="0" max="99"
                      placeholder="0"
                      value={descuento}
                      onChange={(e) => setDescuento(e.target.value === '' ? '' : Math.min(99, parseInt(e.target.value, 10)))}
                      className={`w-full max-w-full box-border pl-11 sm:pl-12 pr-4 sm:pr-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:bg-themeCard focus:border-orange-500 transition-all ${Number(descuento) > 0 ? 'text-orange-500' : ''}`}
                    />
                  </div>
                  {Number(descuento) > 0 && Number(precio) > 0 && (
                    <p className="text-[10px] text-orange-500 font-bold mt-1.5 ml-1">
                      Precio final: ${Math.round(Number(precio) * (1 - Number(descuento) / 100)).toLocaleString()} COP
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: Especificaciones y Media */}
          <div className="w-full max-w-full min-w-0 flex flex-col gap-5 sm:gap-8 box-border">
            
            {/* Descripciones */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2 mb-1 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <FileText size={14} /> Descripción del Hardware
              </div>
              
              <div className="min-w-0">
                <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Subtítulo Corto (Máx 160) *</label>
                <input
                  type="text"
                  required maxLength={160}
                  placeholder="Resumen que aparecerá en la tarjeta del catálogo..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full max-w-full box-border px-4 sm:px-5 py-3 sm:py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                />
              </div>
              
              <div className="min-w-0">
                <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Ficha Técnica Detallada</label>
                <textarea
                  rows={5}
                  placeholder="Escribe toda la información detallada para la página del producto..."
                  value={descripcionLarga}
                  onChange={(e) => setDescripcionLarga(e.target.value)}
                  className="w-full max-w-full box-border px-4 sm:px-5 py-3.5 sm:py-4 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-medium focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all resize-y custom-scrollbar"
                />
              </div>
            </div>

            {/* Especificaciones Clave-Valor */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm space-y-4 sm:space-y-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                  <Cpu size={14} /> Specs Técnicas
                </div>
                <span className="text-[10px] text-themeTextMuted font-bold">{specs.length} agregadas</span>
              </div>
              
              <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 w-full max-w-full box-border">
                <input
                  type="text"
                  placeholder="Propiedad (ej. Zócalo)"
                  value={nuevaSpecKey}
                  onChange={(e) => setNuevaSpecKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSpec(); } }}
                  className="w-full md:flex-1 max-w-full box-border px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <input
                  type="text"
                  placeholder="Valor (ej. AM5)"
                  value={nuevaSpecValue}
                  onChange={(e) => setNuevaSpecValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSpec(); } }}
                  className="w-full md:flex-1 max-w-full box-border px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <button
                  type="button"
                  onClick={agregarSpec}
                  className="w-full md:w-auto bg-themeAccent/10 text-themeAccent hover:bg-themeAccent hover:text-white px-5 py-3 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus size={16} />
                  <span className="md:hidden">Añadir especificación</span>
                </button>
              </div>

              {specs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 max-h-[220px] overflow-y-auto overflow-x-auto custom-scrollbar pr-1 w-full max-w-full box-border">
                  {specs.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-themeInput/50 p-3 rounded-xl border border-themeBorder/40 text-xs group hover:border-themeAccent/30 transition-all min-w-0">
                      <div className="truncate pr-2 min-w-0">
                        <span className="font-black text-themeTextMuted mr-1.5">{item.key}:</span>
                        <span className="font-bold text-themeText">{item.value}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarSpec(item.key)}
                        className="text-red-500/60 hover:text-red-500 transition-colors p-1 shrink-0"
                        title="Eliminar especificación"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Galería Adicional con Staging de Eliminación / Restauración */}
            <div className="w-full max-w-full box-border bg-themeCard p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-themeBorder/40 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                  <ImagePlus size={14} /> Galería Adicional
                </div>
                {marcadasCount > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    {marcadasCount} marcada(s) para eliminar al guardar
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full max-w-full box-border">
                <input
                  type="url"
                  placeholder="URL de imagen extra..."
                  value={nuevaImgUrl}
                  onChange={(e) => setNuevaImgUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarImagenAdicional(); } }}
                  className="w-full sm:flex-1 max-w-full box-border px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <button
                  type="button"
                  onClick={agregarImagenAdicional}
                  className="w-full sm:w-auto bg-themeAccent/10 text-themeAccent hover:bg-themeAccent hover:text-white px-5 py-3 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus size={16} />
                  <span className="sm:hidden">Añadir imagen</span>
                </button>
              </div>

              {imagenesAdicionales.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full max-w-full box-border">
                  {imagenesAdicionales.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className={`relative aspect-square rounded-xl overflow-hidden border transition-all shadow-sm group ${
                        item.markedForDeletion
                          ? 'border-red-500/60 bg-red-950/20'
                          : 'border-themeBorder/60'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={`Preview ${index}`}
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          item.markedForDeletion
                            ? 'opacity-30 grayscale scale-95'
                            : 'group-hover:scale-105'
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/1e293b/475569?text=Imagen';
                        }}
                      />

                      {item.markedForDeletion ? (
                        <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center p-2 text-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-red-300 bg-red-500/20 border border-red-400/30 px-2 py-0.5 rounded-md leading-tight">
                            Marcada para eliminar
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEliminarImagenAdicional(index)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md transition-all active:scale-95"
                          >
                            <RotateCcw size={12} /> Restaurar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleEliminarImagenAdicional(index)}
                          title="Marcar para eliminar"
                          className="absolute top-2 right-2 sm:inset-0 bg-black/65 sm:bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-red-400 hover:text-red-300 p-2 rounded-lg sm:rounded-none"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </form>

        {/* FOOTER ACCIONES STICKY (accesible en móvil y desktop sin solaparse) */}
        <div className="px-4 py-3.5 sm:p-6 bg-themeCard/95 backdrop-blur-xl border-t border-themeBorder/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)] w-full max-w-full box-border">
          
          {/* Zona Izquierda: Eliminar Producto */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            {productoAEditar && !mostrarConfirmarEliminar && (
              <button
                type="button"
                onClick={() => setMostrarConfirmarEliminar(true)}
                className="w-full sm:w-auto justify-center text-red-500/80 hover:text-red-500 hover:bg-red-500/10 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 border border-red-500/20 sm:border-transparent"
              >
                <Trash2 size={15} /> Eliminar Producto
              </button>
            )}
            
            {mostrarConfirmarEliminar && (
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 bg-red-500/10 text-red-500 px-3.5 py-2 rounded-xl sm:rounded-2xl border border-red-500/20 animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span className="text-[10px] font-black uppercase tracking-wider">¿Confirmar borrado?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={handleEliminar} disabled={cargando} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                    {cargando ? <Loader2 size={12} className="animate-spin" /> : "Sí"}
                  </button>
                  <button type="button" onClick={() => setMostrarConfirmarEliminar(false)} className="text-themeText hover:text-white bg-themeInput/80 hover:bg-themeBorder px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                    No
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Zona Derecha: Guardar / Cancelar */}
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={cargando}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-[11px] font-black uppercase tracking-widest text-themeText hover:bg-themeInput border border-themeBorder/60 transition-all active:scale-95 text-center"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleGuardar()}
              disabled={cargando}
              className="flex-1 sm:flex-initial justify-center bg-themeAccent hover:bg-themeAccentHover text-white px-5 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-themeAccent/20 hover:shadow-themeAccent/40 flex items-center gap-2"
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{cargando ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
