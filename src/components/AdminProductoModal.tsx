import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Save,
  AlertTriangle,
  ImagePlus,
  Cpu,
  Tag,
  DollarSign,
  Package,
  FileText,
  Image as ImageIcon,
  Percent,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Producto } from '../types';
import { useProductosStore, fetchProductoDetalle } from '../hooks/useProductos';

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

type ModalTab = 'general' | 'ficha' | 'galeria';

export default function AdminProductoModal({ isOpen, onClose, productoAEditar }: AdminProductoModalProps) {
  const agregarProductoStore = useProductosStore((s) => s.agregarProductoStore);
  const actualizarProductoStore = useProductosStore((s) => s.actualizarProductoStore);
  const eliminarProductoStore = useProductosStore((s) => s.eliminarProductoStore);

  const [cargando, setCargando] = useState(false);
  const [mostrarConfirmarEliminar, setMostrarConfirmarEliminar] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [tabActiva, setTabActiva] = useState<ModalTab>('general');
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
    }, 220);
  }, [cargando, onClose]);

  // Bloquear scroll del body y cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Cargar datos del producto (incluyendo imágenes de galería desde detalle si se abrió desde el catálogo)
  useEffect(() => {
    if (!isOpen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMostrarConfirmarEliminar(false);
    setImagenPrincipalMarcadaEliminar(false);
    setTabActiva('general');
    setNuevaImgUrl('');
    setNuevaSpecKey('');
    setNuevaSpecValue('');

    if (productoAEditar) {
      const imgPrincipal = (productoAEditar.imagen || '').trim();
      setNombre(productoAEditar.nombre || '');
      setPrecio(productoAEditar.precio || 0);
      setImagen(imgPrincipal);
      setCategoria(productoAEditar.categoria || 'Componentes');
      setMarca(productoAEditar.marca || '');
      setStock(productoAEditar.stock ?? 10);
      setDescuento(productoAEditar.descuento ?? 0);
      setDescripcion(productoAEditar.descripcion || '');
      setDescripcionLarga(productoAEditar.descripcion_larga || '');

      const extraerGaleriaExtra = (lista?: { url: string }[]) =>
        (lista ?? [])
          .map((img) => (img.url || '').trim())
          .filter((url) => Boolean(url) && url !== imgPrincipal)
          .map((url) => ({ url, markedForDeletion: false }));

      setImagenesAdicionales(extraerGaleriaExtra(productoAEditar.imagenes));

      if (productoAEditar.especificaciones) {
        setSpecs(
          Object.entries(productoAEditar.especificaciones).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        );
      } else {
        setSpecs([]);
      }

      // Si se abrió desde Home (donde producto.imagenes no viene en el listado), sincronizar galería real
      if (!productoAEditar.imagenes) {
        let cancelado = false;
        fetchProductoDetalle(productoAEditar.id)
          .then((res) => {
            if (cancelado || !res.producto?.imagenes) return;
            setImagenesAdicionales(extraerGaleriaExtra(res.producto.imagenes));
          })
          .catch(() => {
            // ignorar fallo silencioso
          });
        return () => {
          cancelado = true;
        };
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
  }, [productoAEditar, isOpen]);

  const agregarImagenAdicional = () => {
    const cleanUrl = nuevaImgUrl.trim();
    if (!cleanUrl) return;
    if (cleanUrl === imagen.trim() && !imagenPrincipalMarcadaEliminar) {
      toast.warning('Esa URL ya es la imagen principal del producto.');
      return;
    }
    const existingIdx = imagenesAdicionales.findIndex((item) => item.url === cleanUrl);
    if (existingIdx !== -1) {
      if (imagenesAdicionales[existingIdx].markedForDeletion) {
        setImagenesAdicionales((prev) =>
          prev.map((item, idx) => (idx === existingIdx ? { ...item, markedForDeletion: false } : item))
        );
        setNuevaImgUrl('');
        toast.info('Imagen restaurada en la galería.');
        return;
      }
      toast.warning('La URL de la imagen ya está agregada.');
      return;
    }
    setImagenesAdicionales([...imagenesAdicionales, { url: cleanUrl, markedForDeletion: false }]);
    setNuevaImgUrl('');
  };

  // Manejo en memoria/staging: marcar o restaurar sin mutar BD hasta Guardar Cambios
  const toggleEliminarImagenAdicional = (idx: number) => {
    setImagenesAdicionales((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, markedForDeletion: !item.markedForDeletion } : item))
    );
  };

  const agregarSpec = () => {
    if (!nuevaSpecKey.trim() || !nuevaSpecValue.trim()) {
      toast.warning('Falta la propiedad o el valor.');
      return;
    }
    if (specs.some((s) => s.key.toLowerCase() === nuevaSpecKey.trim().toLowerCase())) {
      toast.warning('La especificación ya existe.');
      return;
    }
    setSpecs([...specs, { key: nuevaSpecKey.trim(), value: nuevaSpecValue.trim() }]);
    setNuevaSpecKey('');
    setNuevaSpecValue('');
  };

  const eliminarSpec = (key: string) => {
    setSpecs(specs.filter((s) => s.key !== key));
  };

  const handleGuardar = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const imagenesExtraActivas = imagenesAdicionales
      .filter((img) => !img.markedForDeletion)
      .map((img) => img.url);

    // Si la imagen principal fue marcada para eliminar, promover la primera activa de la galería si existe
    const imagenPrincipalFinal = imagenPrincipalMarcadaEliminar
      ? imagenesExtraActivas[0] || ''
      : imagen.trim();

    if (!nombre.trim()) {
      setTabActiva('general');
      return toast.error('El nombre del producto es obligatorio.');
    }
    if (!marca.trim()) {
      setTabActiva('general');
      return toast.error('La marca es obligatoria.');
    }
    if (precio === '' || precio < 0) {
      setTabActiva('general');
      return toast.error('Ingresa un precio válido mayor o igual a 0.');
    }
    if (stock === '' || stock < 0) {
      setTabActiva('general');
      return toast.error('Ingresa un stock válido mayor o igual a 0.');
    }
    if (!imagenPrincipalFinal) {
      setTabActiva('general');
      return toast.error('El producto requiere una imagen principal activa (restaura la actual o ingresa una nueva URL).');
    }
    if (!descripcion.trim()) {
      setTabActiva('general');
      return toast.error('La descripción corta es obligatoria.');
    }

    setCargando(true);

    const especificacionesObj: Record<string, string> = {};
    specs.forEach((s) => {
      especificacionesObj[s.key] = s.value;
    });

    // Construir lista final de galería sincronizada (imagen principal en orden 0 + extras sin duplicados)
    const urlsFinales = [
      imagenPrincipalFinal,
      ...imagenesExtraActivas.filter((url) => url !== imagenPrincipalFinal),
    ];

    const imagenesFormateadas = urlsFinales.map((url, idx) => ({
      id: 0,
      url,
      orden: idx,
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
      imagenes: imagenesFormateadas,
    };

    try {
      if (productoAEditar) {
        await actualizarProductoStore(productoAEditar.id, datosProducto);
        toast.success('¡Producto actualizado exitosamente!');
      } else {
        await agregarProductoStore(datosProducto);
        toast.success('¡Nuevo producto agregado al catálogo!');
      }
      handleClose();
    } catch (err) {
      toast.error('Error crítico al guardar', {
        description: err instanceof Error ? err.message : 'Por favor, verifica tu conexión e inténtalo de nuevo.',
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
      toast.success('Producto eliminado permanentemente.');
      handleClose();
    } catch (err) {
      toast.error('Error al eliminar', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setCargando(false);
      setMostrarConfirmarEliminar(false);
    }
  };

  if (!isOpen) return null;

  const backdropAnim = cerrando ? 'animate-backdrop-out' : 'animate-backdrop-in';
  const modalAnim = cerrando ? 'animate-modal-out scale-95 opacity-0' : 'animate-modal-in scale-100 opacity-100';
  const marcadasCount =
    imagenesAdicionales.filter((i) => i.markedForDeletion).length + (imagenPrincipalMarcadaEliminar ? 1 : 0);

  return createPortal(
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 transition-all duration-200 ${backdropAnim}`}
      onClick={handleClose}
      data-lenis-prevent="true"
    >
      <div
        className={`relative w-full max-w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] bg-themeBg sm:rounded-2xl border-0 sm:border border-themeBorder/70 shadow-2xl flex flex-col overflow-hidden box-border transition-all duration-200 ${modalAnim}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO COMPACTO + PESTAÑAS DE NAVEGACIÓN RÁPIDA */}
        <div className="bg-themeCard border-b border-themeBorder/50 shrink-0 w-full max-w-full box-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-themeAccent/10 border border-themeAccent/20 flex items-center justify-center shrink-0">
                <Cpu size={18} className="text-themeAccent" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-themeText uppercase truncate">
                  {productoAEditar ? 'Modificar Hardware' : 'Nuevo Hardware'}
                </h2>
                <p className="text-[10px] text-themeTextMuted font-bold uppercase tracking-wider truncate">
                  {productoAEditar ? `${productoAEditar.nombre} · ID #${productoAEditar.id}` : 'Catálogo NEXUS // CORE'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center text-themeTextMuted hover:text-white bg-themeInput/60 hover:bg-red-500 rounded-xl transition-all active:scale-90"
              disabled={cargando}
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Barra de pestañas para evitar scroll excesivo */}
          <div className="grid grid-cols-3 gap-1 px-3 pb-2.5 sm:px-5">
            <button
              type="button"
              onClick={() => setTabActiva('general')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                tabActiva === 'general'
                  ? 'bg-themeAccent text-white shadow-sm shadow-themeAccent/30'
                  : 'bg-themeInput/60 text-themeTextMuted hover:text-themeText hover:bg-themeInput'
              }`}
            >
              <Tag size={13} className="shrink-0" />
              <span className="truncate">1. General</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('ficha')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                tabActiva === 'ficha'
                  ? 'bg-themeAccent text-white shadow-sm shadow-themeAccent/30'
                  : 'bg-themeInput/60 text-themeTextMuted hover:text-themeText hover:bg-themeInput'
              }`}
            >
              <FileText size={13} className="shrink-0" />
              <span className="truncate">2. Ficha ({specs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('galeria')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all relative ${
                tabActiva === 'galeria'
                  ? 'bg-themeAccent text-white shadow-sm shadow-themeAccent/30'
                  : 'bg-themeInput/60 text-themeTextMuted hover:text-themeText hover:bg-themeInput'
              }`}
            >
              <ImageIcon size={13} className="shrink-0" />
              <span className="truncate">3. Imágenes ({1 + imagenesAdicionales.length})</span>
              {marcadasCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* CUERPO DEL MODAL COMPACTO Y RESPONSIVO */}
        <form
          ref={formRef}
          id="admin-producto-form"
          onSubmit={handleGuardar}
          className="flex-1 w-full max-w-full box-border overflow-y-auto overflow-x-hidden custom-scrollbar p-3.5 sm:p-5 space-y-4"
        >
          {/* ================= PESTAÑA 1: GENERAL Y PRECIOS ================= */}
          {tabActiva === 'general' && (
            <div className="grid grid-cols-1 gap-3.5 w-full max-w-full box-border">
              {/* Tarjeta compacta de Imagen Principal */}
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 rounded-2xl border border-themeBorder/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <div className="relative w-full sm:w-28 h-32 sm:h-24 rounded-xl overflow-hidden bg-themeInput border border-themeBorder/60 shrink-0 flex items-center justify-center">
                  {imagen ? (
                    <>
                      <img
                        key={imagen}
                        src={imagen}
                        alt="Preview principal"
                        className={`w-full h-full object-contain p-1 transition-all ${
                          imagenPrincipalMarcadaEliminar ? 'opacity-30 grayscale' : ''
                        }`}
                      />
                      {imagenPrincipalMarcadaEliminar && (
                        <div className="absolute inset-0 bg-black/65 flex items-center justify-center p-1 text-center">
                          <span className="text-[8px] font-black uppercase tracking-wider bg-red-500 text-white px-1.5 py-0.5 rounded">
                            Marcada para eliminar
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-themeTextMuted/50">
                      <ImagePlus size={22} />
                      <span className="text-[9px] font-bold uppercase mt-1">Sin imagen</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black text-themeAccent uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon size={12} /> URL Imagen Principal *
                    </label>
                    {imagen && (
                      <button
                        type="button"
                        onClick={() => setImagenPrincipalMarcadaEliminar((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                          imagenPrincipalMarcadaEliminar
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                        }`}
                      >
                        {imagenPrincipalMarcadaEliminar ? (
                          <>
                            <RotateCcw size={11} /> Restaurar
                          </>
                        ) : (
                          <>
                            <Trash2 size={11} /> Eliminar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={imagen}
                    onChange={(e) => {
                      setImagen(e.target.value);
                      if (imagenPrincipalMarcadaEliminar) setImagenPrincipalMarcadaEliminar(false);
                    }}
                    className="w-full max-w-full box-border px-3 py-2 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/50"
                  />
                </div>
              </div>

              {/* Identificación: Nombre, Marca, Categoría */}
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full max-w-full box-border">
                  <div className="md:col-span-6 min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Nombre Comercial *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. AMD Ryzen 7 5800X"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                    />
                  </div>

                  <div className="md:col-span-3 min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Marca *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. AMD"
                      value={marca}
                      onChange={(e) => setMarca(e.target.value)}
                      className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                    />
                  </div>

                  <div className="md:col-span-3 min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Categoría *
                    </label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                    >
                      <option value="Componentes">Componentes</option>
                      <option value="Periféricos">Periféricos</option>
                    </select>
                  </div>
                </div>

                {/* Subtítulo Corto */}
                <div className="min-w-0">
                  <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                    Descripción Corta (Máx 160 caracteres) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    placeholder="Resumen breve para la tarjeta del catálogo..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                  />
                </div>
              </div>

              {/* Comercialización: Precio, Stock, Descuento */}
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-black text-themeAccent uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={12} /> Precio, Stock y Oferta
                  </span>
                  {Number(descuento) > 0 && Number(precio) > 0 && (
                    <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-black">
                      Precio Final: ${Math.round(Number(precio) * (1 - Number(descuento) / 100)).toLocaleString()} COP
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-full box-border">
                  <div className="min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Precio (COP) *
                    </label>
                    <div className="relative w-full max-w-full">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-themeTextMuted font-black text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="0"
                        value={precio}
                        onChange={(e) => setPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full max-w-full box-border pl-8 pr-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Stock Físico *
                    </label>
                    <div className="relative w-full max-w-full">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-themeTextMuted">
                        <Package size={14} />
                      </span>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className={`w-full max-w-full box-border pl-9 pr-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-black focus:outline-none focus:ring-2 focus:ring-themeAccent/40 ${
                          stock === 0 ? 'text-red-500 border-red-500/40' : ''
                        }`}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className="block text-[10px] font-black text-themeTextMuted uppercase tracking-wider mb-1">
                      Descuento (%)
                    </label>
                    <div className="relative w-full max-w-full">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-themeTextMuted">
                        <Percent size={14} />
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        placeholder="0"
                        value={descuento}
                        onChange={(e) =>
                          setDescuento(e.target.value === '' ? '' : Math.min(99, parseInt(e.target.value, 10)))
                        }
                        className={`w-full max-w-full box-border pl-9 pr-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-black focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                          Number(descuento) > 0 ? 'text-orange-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= PESTAÑA 2: FICHA TÉCNICA Y SPECS ================= */}
          {tabActiva === 'ficha' && (
            <div className="grid grid-cols-1 gap-3.5 w-full max-w-full box-border">
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50 space-y-2">
                <label className="block text-[10px] font-black text-themeAccent uppercase tracking-wider">
                  Descripción Extendida / Ficha Detallada
                </label>
                <textarea
                  rows={4}
                  placeholder="Información detallada para la página del producto..."
                  value={descripcionLarga}
                  onChange={(e) => setDescripcionLarga(e.target.value)}
                  className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-themeAccent/40 resize-y custom-scrollbar"
                />
              </div>

              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50 space-y-3 overflow-x-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-themeAccent uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={13} /> Especificaciones Clave-Valor
                  </span>
                  <span className="text-[10px] text-themeTextMuted font-bold">{specs.length} registradas</span>
                </div>

                <div className="flex flex-col md:flex-row gap-2 w-full max-w-full box-border">
                  <input
                    type="text"
                    placeholder="Propiedad (ej. Zócalo)"
                    value={nuevaSpecKey}
                    onChange={(e) => setNuevaSpecKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarSpec();
                      }
                    }}
                    className="w-full md:flex-1 max-w-full box-border px-3.5 py-2 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                  />
                  <input
                    type="text"
                    placeholder="Valor (ej. AM4)"
                    value={nuevaSpecValue}
                    onChange={(e) => setNuevaSpecValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarSpec();
                      }
                    }}
                    className="w-full md:flex-1 max-w-full box-border px-3.5 py-2 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                  />
                  <button
                    type="button"
                    onClick={agregarSpec}
                    className="w-full md:w-auto bg-themeAccent text-white hover:bg-themeAccentHover px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus size={15} /> Añadir
                  </button>
                </div>

                {specs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-1 w-full max-w-full box-border">
                    {specs.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-themeInput/60 px-3 py-2 rounded-xl border border-themeBorder/40 text-xs min-w-0"
                      >
                        <div className="truncate pr-2 min-w-0">
                          <span className="font-black text-themeTextMuted mr-1.5">{item.key}:</span>
                          <span className="font-bold text-themeText">{item.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarSpec(item.key)}
                          className="text-red-500/70 hover:text-red-500 transition-colors p-1 shrink-0"
                          title="Eliminar especificación"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-themeTextMuted text-center py-4 border border-dashed border-themeBorder/50 rounded-xl">
                    Aún no has agregado especificaciones técnicas.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ================= PESTAÑA 3: GESTOR DE IMÁGENES CON DESHACER/RESTAURAR ================= */}
          {tabActiva === 'galeria' && (
            <div className="grid grid-cols-1 gap-3.5 w-full max-w-full box-border">
              {marcadasCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-400 font-bold">
                  <span>
                    {marcadasCount} imagen(es) marcada(s) para eliminar. Solo se borrarán al pulsar "Guardar Cambios".
                  </span>
                </div>
              )}

              {/* Imagen Principal en Gestor */}
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-themeAccent uppercase tracking-wider">
                    Imagen Principal del Producto
                  </span>
                  {imagen && (
                    <button
                      type="button"
                      onClick={() => setImagenPrincipalMarcadaEliminar((prev) => !prev)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        imagenPrincipalMarcadaEliminar
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white'
                      }`}
                    >
                      {imagenPrincipalMarcadaEliminar ? (
                        <>
                          <RotateCcw size={12} /> Restaurar Principal
                        </>
                      ) : (
                        <>
                          <Trash2 size={12} /> Marcar para Eliminar
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-themeInput border border-themeBorder/60 shrink-0 flex items-center justify-center">
                    {imagen ? (
                      <>
                        <img
                          key={imagen}
                          src={imagen}
                          alt="Principal"
                          className={`w-full h-full object-contain p-1 transition-all ${
                            imagenPrincipalMarcadaEliminar ? 'opacity-30 grayscale' : ''
                          }`}
                        />
                        {imagenPrincipalMarcadaEliminar && (
                          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                            <span className="bg-red-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded">
                              Marcada para eliminar
                            </span>
                            <button
                              type="button"
                              onClick={() => setImagenPrincipalMarcadaEliminar(false)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1"
                            >
                              <RotateCcw size={11} /> Restaurar
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-themeTextMuted font-bold uppercase">Sin imagen</span>
                    )}
                  </div>
                  <div className="w-full flex-1 space-y-1.5">
                    <label className="block text-[10px] font-bold text-themeTextMuted uppercase">
                      URL de portada:
                    </label>
                    <input
                      type="url"
                      placeholder="URL de la imagen principal..."
                      value={imagen}
                      onChange={(e) => {
                        setImagen(e.target.value);
                        if (imagenPrincipalMarcadaEliminar) setImagenPrincipalMarcadaEliminar(false);
                      }}
                      className="w-full max-w-full box-border px-3.5 py-2.5 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-themeAccent/50"
                    />
                  </div>
                </div>
              </div>

              {/* Galería Adicional */}
              <div className="w-full max-w-full box-border bg-themeCard p-3.5 sm:p-4 rounded-2xl border border-themeBorder/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-themeAccent uppercase tracking-wider flex items-center gap-1.5">
                    <ImagePlus size={13} /> Galería de Imágenes Adicionales
                  </span>
                  <span className="text-[10px] text-themeTextMuted font-bold">
                    {imagenesAdicionales.filter((i) => !i.markedForDeletion).length} activas
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-full box-border">
                  <input
                    type="url"
                    placeholder="Pegar URL de imagen adicional..."
                    value={nuevaImgUrl}
                    onChange={(e) => setNuevaImgUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarImagenAdicional();
                      }
                    }}
                    className="w-full sm:flex-1 max-w-full box-border px-3.5 py-2 bg-themeInput border border-themeBorder/60 rounded-xl text-themeText text-xs font-bold focus:outline-none focus:ring-2 focus:ring-themeAccent/40"
                  />
                  <button
                    type="button"
                    onClick={agregarImagenAdicional}
                    className="w-full sm:w-auto bg-themeAccent text-white hover:bg-themeAccentHover px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus size={15} /> Añadir a Galería
                  </button>
                </div>

                {imagenesAdicionales.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full max-w-full box-border">
                    {imagenesAdicionales.map((item, index) => (
                      <div
                        key={`${item.url}-${index}`}
                        className={`relative aspect-square rounded-xl overflow-hidden border transition-all shadow-sm group ${
                          item.markedForDeletion
                            ? 'border-red-500/60 bg-red-950/20'
                            : 'border-themeBorder/60 bg-themeInput/40'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={`Galería ${index + 1}`}
                          className={`w-full h-full object-cover transition-all duration-300 ${
                            item.markedForDeletion ? 'opacity-30 grayscale scale-95' : 'group-hover:scale-105'
                          }`}
                        />

                        {item.markedForDeletion ? (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-2 text-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-red-200 bg-red-500/30 border border-red-400/40 px-2 py-0.5 rounded-md leading-tight">
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
                            className="absolute top-2 right-2 bg-black/75 hover:bg-red-600 text-white p-2 rounded-lg shadow-md transition-all active:scale-90 flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-themeTextMuted text-center py-6 border border-dashed border-themeBorder/50 rounded-xl">
                    No hay imágenes secundarias en la galería de este producto.
                  </p>
                )}
              </div>
            </div>
          )}
        </form>

        {/* FOOTER STICKY ACCESIBLE EN CUALQUIER RESOLUCIÓN */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-themeCard border-t border-themeBorder/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 w-full max-w-full box-border">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {productoAEditar && !mostrarConfirmarEliminar && (
              <button
                type="button"
                onClick={() => setMostrarConfirmarEliminar(true)}
                className="w-full sm:w-auto justify-center text-red-500 hover:bg-red-500/10 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 border border-red-500/20"
              >
                <Trash2 size={14} /> Eliminar Hardware
              </button>
            )}

            {mostrarConfirmarEliminar && (
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-xl border border-red-500/20">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-black uppercase">¿Borrar producto?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={cargando}
                    className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold"
                  >
                    {cargando ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarEliminar(false)}
                    className="text-themeText bg-themeInput px-2.5 py-1 rounded-lg text-xs font-bold"
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={cargando}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-themeText hover:bg-themeInput border border-themeBorder/60 transition-all active:scale-95 text-center"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleGuardar()}
              disabled={cargando}
              className="flex-1 sm:flex-initial justify-center bg-themeAccent hover:bg-themeAccentHover text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-themeAccent/25 flex items-center gap-2"
            >
              {cargando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{cargando ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
