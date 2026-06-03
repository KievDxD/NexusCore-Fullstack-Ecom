import { useState, memo } from "react";
import { Link } from "react-router-dom";
import { useCarrito, type Producto } from "../hooks/useCarrito"; 
import { useSettings } from "../hooks/useSettings"; 
import { convertPrice, formatCurrency } from "../utils/currency";
import "./TarjetaProducto.css";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Pencil } from "lucide-react";
import AdminProductoModal from "./AdminProductoModal";

export default memo(function TarjetaProducto({ producto }: { producto: Producto }) {
  const agregarProducto = useCarrito((state) => state.agregarProducto);
  const { currency, rates } = useSettings();
  const { isAdmin } = useAuth();

  const tieneDescuento = (producto.descuento ?? 0) > 0;
  const precioOriginal = convertPrice(producto.precio, currency, rates);
  const precioFinal = tieneDescuento 
    ? convertPrice(producto.precio * (1 - (producto.descuento ?? 0) / 100), currency, rates)
    : precioOriginal;
    
  const precioOriginalFormateado = formatCurrency(precioOriginal, currency);
  const precioFinalFormateado = formatCurrency(precioFinal, currency);

  const [cantidad, setCantidad] = useState(1);
  const [estaAgregando, setEstaAgregando] = useState(false);
  const [animarNumero, setAnimarNumero] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);

  const stockDisponible = producto.stock ?? 10;
  const sinStock = stockDisponible === 0;

  const dispararAnimacionNumero = () => {
    setAnimarNumero(true);
    setTimeout(() => setAnimarNumero(false), 200);
  };

  const aumentar = () => {
    if (cantidad < stockDisponible) {
      setCantidad(cantidad + 1);
      dispararAnimacionNumero();
    } else {
      toast.warning("Límite de stock", {
        description: `Solo hay ${stockDisponible} unidades disponibles.`
      });
    }
  };

  const disminuir = () => {
    if (cantidad > 1) {
      setCantidad(cantidad - 1);
      dispararAnimacionNumero();
    }
  };

  const handleAgregar = () => {
    if (sinStock) return;
    
    agregarProducto(producto, cantidad);
    
    toast.success(`Añadido: ${cantidad}x ${producto.nombre} al carrito`, {
      description: "¡Listo para cotizar en tu carrito!",
      duration: 2000,
    });
    setEstaAgregando(true);
    setCantidad(1); 
    setTimeout(() => setEstaAgregando(false), 1000);
  };

  return (
    <>
      <div className="product-card group relative">
        {/* Botón flotante de edición para administradores */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setModalEditOpen(true);
            }}
            className="absolute top-3 right-3 bg-themeCard/90 hover:bg-themeAccent text-themeText hover:text-white p-2 rounded-xl z-10 shadow-lg border border-themeBorder/80 hover:border-themeAccent transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Editar Hardware"
          >
            <Pencil size={13} />
          </button>
        )}
      {/* Badges de inventario premium */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        {sinStock && (
          <span className="bg-red-600/90 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg backdrop-blur-sm self-start">
            Agotado
          </span>
        )}
        {!sinStock && stockDisponible <= 3 && (
          <span className="bg-amber-500/90 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg backdrop-blur-sm animate-pulse self-start">
            ¡Últimas {stockDisponible} uds!
          </span>
        )}
        {tieneDescuento && (
          <span className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-orange-500/30 shadow-lg backdrop-blur-md animate-gradient bg-[length:200%_auto] border border-white/20 flex items-center gap-1.5 self-start transition-transform hover:scale-110">
            <span className="animate-pulse">🔥</span> 
            <span>-{producto.descuento}%</span>
          </span>
        )}
      </div>

      {/* Enlace al detalle del producto */}
      <Link to={`/producto/${producto.id}`} className="block focus:outline-none">
        {/* Contenedor de Imagen */}
        <div className="product-card__image-wrapper overflow-hidden relative rounded-t-xl">
          <img 
            src={producto.imagen} 
            alt={producto.nombre} 
            loading="lazy"
            decoding="async"
            width={600}
            height={400}
            className="product-card__image group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=Hardware';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
            <span className="text-[10px] bg-themeCard/90 text-themeText font-bold uppercase tracking-wider py-1.5 px-3 rounded-full shadow-md backdrop-blur-sm border border-themeBorder/40">
              Ver detalles
            </span>
          </div>
        </div>
        
        {/* Textos Informativos */}
        <div className="p-1">
          <span className="text-[9px] text-themeAccent font-bold uppercase tracking-wider block mb-1">
            {producto.marca || 'NEXUS'}
          </span>
          <h3 className="product-card__title group-hover:text-themeAccent transition-colors line-clamp-2 min-h-[40px]">
            {producto.nombre}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <p className="product-card__price">{precioFinalFormateado}</p>
            {tieneDescuento && (
              <p className="text-[10px] text-themeTextMuted line-through opacity-70">
                {precioOriginalFormateado}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="product-card__actions mt-3">
        {/* CONTADOR DE CANTIDAD */}
        <div className="product-card__counter">
          <span className="product-card__counter-label">Cant.</span>
          
          <div className="product-card__counter-controls">
            <button 
              onClick={disminuir}
              disabled={sinStock}
              className={`product-card__counter-btn ${sinStock ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              -
            </button>

            <span className={`product-card__counter-value ${
              animarNumero ? "product-card__counter-value--animating" : ""
            } ${sinStock ? 'opacity-30' : ''}`}>
              {sinStock ? 0 : cantidad}
            </span>

            <button 
              onClick={aumentar}
              disabled={sinStock}
              className={`product-card__counter-btn ${sinStock ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              +
            </button>
          </div>
        </div>

        {/* BOTÓN PRINCIPAL DE COMPRA */}
        <button 
          onClick={handleAgregar} 
          disabled={estaAgregando || sinStock}
          className={`product-card__submit-btn ${
            sinStock 
              ? "bg-themeBorder text-themeTextMuted cursor-not-allowed opacity-50 border-none shadow-none"
              : estaAgregando 
                ? "product-card__submit-btn--adding" 
                : "product-card__submit-btn--idle"
          }`}
        >
          {sinStock ? "Agotado" : estaAgregando ? "¡Añadido! ✓" : "Agregar al carrito"}
        </button>
      </div>
      </div>
      
      {/* Modal de edición */}
      <AdminProductoModal 
        isOpen={modalEditOpen} 
        onClose={() => setModalEditOpen(false)} 
        productoAEditar={producto} 
      />
    </>
  );
});