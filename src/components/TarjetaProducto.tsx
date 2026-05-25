import { useState } from "react";
import { Link } from "react-router-dom";
import { useCarrito, type Producto } from "../hooks/useCarrito"; 
import { useSettings } from "../hooks/useSettings"; 
import { convertPrice, formatCurrency } from "../utils/currency";
import "./TarjetaProducto.css";
import { toast } from "sonner";

export default function TarjetaProducto({ producto }: { producto: Producto }) {
  const agregarProducto = useCarrito((state) => state.agregarProducto);
  const { currency, rates } = useSettings();

  const precioConvertido = convertPrice(producto.precio, currency, rates);
  const precioFormateado = formatCurrency(precioConvertido, currency);

  const [cantidad, setCantidad] = useState(1);
  const [estaAgregando, setEstaAgregando] = useState(false);
  const [animarNumero, setAnimarNumero] = useState(false);

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
    
    for (let i = 0; i < cantidad; i++) {
      agregarProducto(producto);
    }
    
    toast.success(`Añadido: ${cantidad}x ${producto.nombre} al carrito`, {
      description: "¡Listo para cotizar en tu carrito!",
      duration: 2000,
    });
    setEstaAgregando(true);
    setCantidad(1); 
    setTimeout(() => setEstaAgregando(false), 1000);
  };

  return (
    <div className="product-card group relative">
      {/* Badges de inventario premium */}
      {sinStock && (
        <span className="absolute top-3 left-3 bg-red-600/90 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md z-10 shadow-lg backdrop-blur-sm">
          Agotado
        </span>
      )}
      {!sinStock && stockDisponible <= 3 && (
        <span className="absolute top-3 left-3 bg-amber-500/90 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md z-10 shadow-lg backdrop-blur-sm animate-pulse">
          ¡Últimas {stockDisponible} uds!
        </span>
      )}

      {/* Enlace al detalle del producto */}
      <Link to={`/producto/${producto.id}`} className="block focus:outline-none">
        {/* Contenedor de Imagen */}
        <div className="product-card__image-wrapper overflow-hidden relative rounded-t-xl">
          <img 
            src={producto.imagen} 
            alt={producto.nombre} 
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
          <p className="product-card__price mt-1">{precioFormateado}</p>
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
  );
}