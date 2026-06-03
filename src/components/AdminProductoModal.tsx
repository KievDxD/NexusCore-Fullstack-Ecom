import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Save, AlertTriangle, ImagePlus, Cpu, Tag, DollarSign, Package, FileText, Image as ImageIcon, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { type Producto } from '../hooks/useCarrito';
import { useProductos } from '../hooks/useProductos';

interface AdminProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  productoAEditar?: Producto | null;
}

interface SpecItem {
  key: string;
  value: string;
}

export default function AdminProductoModal({ isOpen, onClose, productoAEditar }: AdminProductoModalProps) {
  const { agregarProductoStore, actualizarProductoStore, eliminarProductoStore } = useProductos();
  const [cargando, setCargando] = useState(false);
  const [mostrarConfirmarEliminar, setMostrarConfirmarEliminar] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Estados del formulario
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [imagen, setImagen] = useState('');
  const [categoria, setCategoria] = useState('Componentes');
  const [marca, setMarca] = useState('');
  const [stock, setStock] = useState<number | ''>(10);
  const [descuento, setDescuento] = useState<number | ''>(0);
  const [descripcion, setDescripcion] = useState('');
  const [descripcionLarga, setDescripcionLarga] = useState('');
  
  const [imagenesAdicionales, setImagenesAdicionales] = useState<string[]>([]);
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
      setMostrarConfirmarEliminar(false);
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
          ? productoAEditar.imagenes.map(img => img.url).filter(Boolean) 
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
    if (!nuevaImgUrl.trim()) return;
    if (imagenesAdicionales.includes(nuevaImgUrl.trim())) {
      toast.warning("La URL de la imagen ya está agregada.");
      return;
    }
    setImagenesAdicionales([...imagenesAdicionales, nuevaImgUrl.trim()]);
    setNuevaImgUrl('');
  };

  const eliminarImagenAdicional = (idx: number) => {
    setImagenesAdicionales(imagenesAdicionales.filter((_, i) => i !== idx));
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
    
    // Validación específica para mostrar errores claros al usuario
    if (!nombre.trim()) return toast.error("El nombre del producto es obligatorio.");
    if (!marca.trim()) return toast.error("La marca es obligatoria.");
    if (precio === '' || precio < 0) return toast.error("Ingresa un precio válido mayor o igual a 0.");
    if (stock === '' || stock < 0) return toast.error("Ingresa un stock válido mayor o igual a 0.");
    if (!imagen.trim()) return toast.error("La URL de la imagen principal es obligatoria.");
    if (!descripcion.trim()) return toast.error("La descripción corta es obligatoria.");

    setCargando(true);

    const especificacionesObj: Record<string, string> = {};
    specs.forEach(s => { especificacionesObj[s.key] = s.value; });

    // Verificar si las imágenes realmente cambiaron
    let imagenesCambiaron = true;
    if (productoAEditar) {
      const imgsOriginales = productoAEditar.imagenes ? productoAEditar.imagenes.map(img => img.url).filter(Boolean) : [];
      if (imgsOriginales.length === imagenesAdicionales.length) {
        const sonIguales = imgsOriginales.every((url, idx) => url === imagenesAdicionales[idx]);
        if (sonIguales) {
          imagenesCambiaron = false;
        }
      }
    }

    const imagenesFormateadas = imagenesAdicionales.map((url, idx) => ({
      id: 0, url, orden: idx
    }));

    const datosProducto = {
      nombre: nombre.trim(),
      precio: Number(precio),
      imagen: imagen.trim(),
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
    } catch (err: any) {
      toast.error("Error crítico al guardar", {
        description: err.message || "Por favor, verifica tu conexión e inténtalo de nuevo."
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
    } catch (err: any) {
      toast.error("Error al eliminar", { description: err.message });
    } finally {
      setCargando(false);
      setMostrarConfirmarEliminar(false);
    }
  };

  if (!isOpen) return null;

  const backdropAnim = cerrando ? 'animate-backdrop-out' : 'animate-backdrop-in';
  const modalAnim = cerrando ? 'animate-modal-out scale-95 opacity-0' : 'animate-modal-in scale-100 opacity-100';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-themeBg transition-all duration-300 ${backdropAnim}`}
      onClick={handleClose}
      data-lenis-prevent="true"
    >
      <div 
        className={`relative w-full h-full max-w-none bg-themeBg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform ${modalAnim}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO STICKY */}
        <div className="flex items-center justify-between p-6 bg-themeCard/90 backdrop-blur-xl border-b border-themeBorder/40 z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-themeAccent/10 border border-themeAccent/20 flex items-center justify-center shadow-inner">
              <Cpu size={24} className="text-themeAccent" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-themeText uppercase">
                {productoAEditar ? "Modificar Hardware" : "Nuevo Hardware"}
              </h2>
              <p className="text-xs text-themeTextMuted font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                NEXUS // CORE SYSTEM
                {productoAEditar && <span className="text-themeAccent bg-themeAccent/10 px-2 py-0.5 rounded-md">ID: {productoAEditar.id}</span>}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-12 h-12 flex items-center justify-center text-themeTextMuted hover:text-white bg-themeInput/50 hover:bg-red-500/80 rounded-2xl transition-all duration-300 hover:rotate-90 hover:shadow-lg hover:shadow-red-500/20 active:scale-90"
            disabled={cargando}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CUERPO DEL MODAL (2 COLUMNAS EN DESKTOP) */}
        <form 
          id="admin-producto-form" 
          onSubmit={handleGuardar} 
          className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col lg:flex-row gap-8 lg:gap-12"
        >
          
          {/* COLUMNA IZQUIERDA: Info Base y Precio */}
          <div className="w-full lg:w-1/2 flex flex-col gap-8">
            
            {/* Imagen Principal Prominente */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <ImageIcon size={14} /> Imagen Principal
              </div>
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-themeInput border-2 border-dashed border-themeBorder/60 group">
                {imagen ? (
                  <img src={imagen} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1e293b/475569?text=Error+en+URL'; }} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-themeTextMuted">
                    <ImagePlus size={48} className="mb-4 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-wider">Sin imagen principal</p>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <input
                    type="url"
                    required
                    placeholder="URL de la imagen principal..."
                    value={imagen}
                    onChange={(e) => setImagen(e.target.value)}
                    className="w-full px-4 py-3 bg-themeCard/90 backdrop-blur-md border border-themeBorder/60 rounded-xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/80 transition-all placeholder:text-themeTextMuted"
                  />
                </div>
              </div>
            </div>

            {/* Detalles Principales */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm space-y-5">
              <div className="flex items-center gap-2 mb-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <Tag size={14} /> Identificación
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AMD Ryzen 9 7950X3D"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AMD"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="w-full px-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Categoría *</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all appearance-none"
                  >
                    <option value="Componentes">Componentes</option>
                    <option value="Periféricos">Periféricos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Comercial (Precio y Stock) */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm space-y-5">
              <div className="flex items-center gap-2 mb-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <DollarSign size={14} /> Comercialización
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Precio (COP) *</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">$</span>
                    <input
                      type="number"
                      required min="0"
                      placeholder="0"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-10 pr-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-themeCard focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Stock Físico *</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">
                      <Package size={16} />
                    </span>
                    <input
                      type="number"
                      min="0" required
                      placeholder="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className={`w-full pl-12 pr-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all ${stock === 0 ? 'text-red-500 focus:border-red-500 focus:ring-red-500/40' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Descuento %</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black">
                      <Percent size={16} />
                    </span>
                    <input
                      type="number"
                      min="0" max="99"
                      placeholder="0"
                      value={descuento}
                      onChange={(e) => setDescuento(e.target.value === '' ? '' : Math.min(99, parseInt(e.target.value, 10)))}
                      className={`w-full pl-12 pr-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-black focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:bg-themeCard focus:border-orange-500 transition-all ${Number(descuento) > 0 ? 'text-orange-500' : ''}`}
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
          <div className="w-full lg:w-1/2 flex flex-col gap-8">
            
            {/* Descripciones */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm space-y-5">
              <div className="flex items-center gap-2 mb-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <FileText size={14} /> Descripción del Hardware
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Subtítulo Corto (Máx 160) *</label>
                <input
                  type="text"
                  required maxLength={160}
                  placeholder="Resumen que aparecerá en la tarjeta del catálogo..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-5 py-3.5 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-widest mb-2 ml-1">Ficha Técnica Detallada</label>
                <textarea
                  rows={5}
                  placeholder="Escribe toda la información detallada para la página del producto..."
                  value={descripcionLarga}
                  onChange={(e) => setDescripcionLarga(e.target.value)}
                  className="w-full px-5 py-4 bg-themeInput border border-themeBorder/60 rounded-2xl text-themeText text-sm font-medium focus:outline-none focus:ring-2 focus:ring-themeAccent/40 focus:bg-themeCard transition-all resize-y custom-scrollbar"
                />
              </div>
            </div>

            {/* Especificaciones Clave-Valor */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm space-y-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                  <Cpu size={14} /> Specs Técnicas
                </div>
                <span className="text-[10px] text-themeTextMuted font-bold">{specs.length} agregadas</span>
              </div>
              
              <div className="flex flex-wrap md:flex-nowrap gap-3">
                <input
                  type="text"
                  placeholder="Propiedad (ej. Zócalo)"
                  value={nuevaSpecKey}
                  onChange={(e) => setNuevaSpecKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSpec(); } }}
                  className="flex-1 px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <input
                  type="text"
                  placeholder="Valor (ej. AM5)"
                  value={nuevaSpecValue}
                  onChange={(e) => setNuevaSpecValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSpec(); } }}
                  className="flex-1 px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <button
                  type="button"
                  onClick={agregarSpec}
                  className="bg-themeAccent/10 text-themeAccent hover:bg-themeAccent hover:text-white px-5 py-3 rounded-xl text-xs font-black transition-all active:scale-95"
                >
                  <Plus size={16} />
                </button>
              </div>

              {specs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {specs.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-themeInput/50 p-3 rounded-xl border border-themeBorder/40 text-xs group hover:border-themeAccent/30 transition-all">
                      <div className="truncate pr-2">
                        <span className="font-black text-themeTextMuted mr-2">{item.key}:</span>
                        <span className="font-bold text-themeText">{item.value}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarSpec(item.key)}
                        className="text-red-500/50 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Galería Adicional */}
            <div className="bg-themeCard p-6 rounded-3xl border border-themeBorder/40 shadow-sm space-y-5">
              <div className="flex items-center gap-2 mb-2 text-themeAccent font-black uppercase tracking-widest text-[10px]">
                <ImagePlus size={14} /> Galería Adicional
              </div>
              
              <div className="flex gap-3">
                <input
                  type="url"
                  placeholder="URL de imagen extra..."
                  value={nuevaImgUrl}
                  onChange={(e) => setNuevaImgUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarImagenAdicional(); } }}
                  className="flex-1 px-4 py-3 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                />
                <button
                  type="button"
                  onClick={agregarImagenAdicional}
                  className="bg-themeAccent/10 text-themeAccent hover:bg-themeAccent hover:text-white px-5 py-3 rounded-xl text-xs font-black transition-all active:scale-95"
                >
                  <Plus size={16} />
                </button>
              </div>

              {imagenesAdicionales.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {imagenesAdicionales.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-themeBorder/60 group shadow-sm">
                      <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <button
                        type="button"
                        onClick={() => eliminarImagenAdicional(index)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-red-400"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </form>

        {/* FOOTER ACCIONES STICKY */}
        <div className="p-6 bg-themeCard/90 backdrop-blur-xl border-t border-themeBorder/40 flex items-center justify-between shrink-0 z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)]">
          
          {/* Zona Izquierda: Eliminar */}
          <div className="flex items-center gap-4">
            {productoAEditar && !mostrarConfirmarEliminar && (
              <button
                type="button"
                onClick={() => setMostrarConfirmarEliminar(true)}
                className="text-red-500/70 hover:text-red-500 hover:bg-red-500/10 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
              >
                <Trash2 size={16} /> Eliminar
              </button>
            )}
            
            {mostrarConfirmarEliminar && (
              <div className="flex items-center gap-3 bg-red-500/10 text-red-500 px-4 py-2 rounded-2xl border border-red-500/20 animate-fade-in">
                <AlertTriangle size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">¿Confirmar?</span>
                <button type="button" onClick={handleEliminar} disabled={cargando} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-2">
                  {cargando ? <Loader2 size={12} className="animate-spin" /> : "Sí"}
                </button>
                <button type="button" onClick={() => setMostrarConfirmarEliminar(false)} className="text-themeText hover:text-white bg-themeInput/80 hover:bg-themeBorder px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                  No
                </button>
              </div>
            )}
          </div>

          {/* Zona Derecha: Guardar / Cancelar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={cargando}
              className="px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-themeText hover:bg-themeInput border border-themeBorder/60 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleGuardar()}
              disabled={cargando}
              className="bg-themeAccent hover:bg-themeAccentHover text-white px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-themeAccent/20 hover:shadow-themeAccent/40 flex items-center gap-2"
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {cargando ? "Guardando..." : "Guardar Producto"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
