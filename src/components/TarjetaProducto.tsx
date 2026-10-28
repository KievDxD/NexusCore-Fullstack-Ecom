import { useState, memo } from "react";
import { Link } from "react-router-dom";
import { useCarritoStore, useCantidadEnCarrito, MENSAJE_LIMITE_STOCK } from "../hooks/useCarrito";
import { useSettings } from "../hooks/useSettings";
import { convertPrice, formatCurrency, precioConDescuento } from "../utils/currency";
import { getDiscountBadgeStyle } from "../utils/discount";
import "./TarjetaProducto.css";
import { toast } from "sonner";
import type { Producto } from "../types";
import { Pencil, Cpu } from "lucide-react";

interface TarjetaProductoProps {
  producto: Producto;
  isAdmin?: boolean;
  onEditar?: (producto: Producto) => void;
}

export default memo(function TarjetaProducto({ producto, isAdmin = false, onEditar }: TarjetaProductoProps) {
  // Selectores granulares: la tarjeta solo se re-renderiza si cambia la cantidad de ESTE producto
  const agregarProducto = useCarritoStore((s) => s.agregarProducto);
  const enCarrito = useCantidadEnCarrito(producto.id);
  const currency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);

  const badge = getDiscountBadgeStyle(producto.descuento);
  const tieneDescuento = badge.tier !== 'none';
  const precioOriginal = convertPrice(producto.precio, currency, rates);
  const precioFinal = tieneDescuento
    ? convertPrice(precioConDescuento(producto), currency, rates)
    : precioOriginal;

  const precioOriginalFormateado = formatCurrency(precioOriginal, currency);
  const precioFinalFormateado = formatCurrency(precioFinal, currency);

  const [cantidad, setCantidad] = useState(1);
  const [estaAgregando, setEstaAgregando] = useState(false);
  const [animarNumero, setAnimarNumero] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const imgCargada = Boolean(producto.imagen) && loadedSrc === producto.imagen;
  const imgConError = !producto.imagen || errorSrc === producto.imagen;

  const stockDisponible = producto.stock ?? 10;
  const sinStock = stockDisponible === 0;
  // Unidades que aún se pueden añadir teniendo en cuenta lo que ya está en el carrito
  const restante = Math.max(stockDisponible - enCarrito, 0);
  const limiteAlcanzado = !sinStock && enCarrito >= stockDisponible;
  const bloqueado = sinStock || limiteAlcanzado;
  const cantidadVisible = bloqueado ? 0 : Math.min(cantidad, restante);

  const dispararAnimacionNumero = () => {
    setAnimarNumero(true);
    setTimeout(() => setAnimarNumero(false), 200);
  };

  const aumentar = () => {
    if (bloqueado) {
      toast.warning(MENSAJE_LIMITE_STOCK, {
        description: `Ya tienes las ${stockDisponible} unidades disponibles en tu carrito.`,
      });
      return;
    }
    if (cantidadVisible < restante) {
      const nuevaCant = cantidadVisible + 1;
      setCantidad(nuevaCant);
      dispararAnimacionNumero();
      if (nuevaCant >= restante) {
        toast.warning("Límite de stock alcanzado", {
          description:
            enCarrito > 0
              ? `${MENSAJE_LIMITE_STOCK} (${enCarrito} en carrito + ${nuevaCant} seleccionada(s) = ${stockDisponible} máx).`
              : `${MENSAJE_LIMITE_STOCK} (${stockDisponible} unidades disponibles).`,
        });
      }
    } else {
      toast.warning("Límite de stock", {
        description:
          enCarrito > 0
            ? `${MENSAJE_LIMITE_STOCK}. Ya tienes ${enCarrito} en el carrito y ${cantidadVisible} seleccionada(s).`
            : `Solo hay ${stockDisponible} unidades disponibles.`,
      });
    }
  };

  const disminuir = () => {
    if (cantidadVisible > 1) {
      setCantidad(cantidadVisible - 1);
      dispararAnimacionNumero();
    }
  };

  const handleAgregar = () => {
    if (sinStock) return;
    // Guardián: no se toca el store si ya se alcanzó el stock
    if (limiteAlcanzado || cantidadVisible <= 0) {
      toast.info(MENSAJE_LIMITE_STOCK);
      return;
    }

    const llegaraAlLimite = enCarrito + cantidadVisible >= stockDisponible;

    if (!agregarProducto(producto, cantidadVisible)) {
      toast.info(MENSAJE_LIMITE_STOCK);
      return;
    }

    toast.success(`Añadido: ${cantidadVisible}x ${producto.nombre} al carrito`, {
      description: llegaraAlLimite
        ? MENSAJE_LIMITE_STOCK
        : "¡Listo para cotizar en tu carrito!",
      duration: 2500,
    });
    setEstaAgregando(true);
    setCantidad(1);
    setTimeout(() => setEstaAgregando(false), 1000);
  };

  return (
    <div className="product-card group relative">
      {/* Botón flotante de edición para administradores */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditar?.(producto);
          }}
          className="absolute top-3 right-3 bg-themeCard/90 hover:bg-themeAccent text-themeText hover:text-white p-2 rounded-xl z-10 shadow-lg border border-themeBorder/80 hover:border-themeAccent transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title="Editar Hardware"
        >
          <Pencil size={13} />
        </button>
      )}

      {/* Badges de inventario y descuento progresivo premium */}
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
          <span
            className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start transition-all duration-300 hover:scale-110 ${badge.className}`}
          >
            <span className={badge.tier === 'high' ? 'animate-bounce' : 'animate-pulse'}>
              {badge.icon}
            </span>
            <span>-{badge.percentage}%</span>
            {badge.tier === 'high' && (
              <span className="text-[8px] bg-black/25 px-1.5 py-0.5 rounded-md tracking-wider">
                HOT
              </span>
            )}
          </span>
        )}
      </div>

      {/* Enlace al detalle del producto */}
      <Link to={`/producto/${producto.id}`} className="block focus:outline-none">
        {/* Contenedor de Imagen con Skeleton Limpio mientras carga */}
        <div className="product-card__image-wrapper overflow-hidden relative rounded-t-xl">
          {!imgCargada && !imgConError && (
            <div className="absolute inset-0 bg-themeInput animate-pulse flex flex-col items-center justify-center gap-2 z-[1]">
              <Cpu size={28} className="text-themeTextMuted/30" />
              <span className="text-[9px] font-black uppercase tracking-widest text-themeTextMuted/40">
                Cargando imagen...
              </span>
            </div>
          )}

          {imgConError ? (
            <div className="w-full h-full bg-themeInput flex flex-col items-center justify-center gap-2 text-themeTextMuted/50 p-4 text-center">
              <Cpu size={32} className="text-themeAccent/50" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {producto.marca || 'NEXUS // CORE'}
              </span>
            </div>
          ) : (
            <img
              key={producto.imagen}
              src={producto.imagen}
              alt={producto.nombre}
              loading="lazy"
              decoding="async"
              width={600}
              height={400}
              onLoad={() => setLoadedSrc(producto.imagen)}
              onError={() => setErrorSrc(producto.imagen)}
              className={`product-card__image group-hover:scale-105 transition-all duration-500 ${
                imgCargada ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-[2]">
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
              disabled={bloqueado || cantidadVisible <= 1}
              aria-label="Disminuir cantidad"
              className={`product-card__counter-btn ${bloqueado || cantidadVisible <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              -
            </button>

            <span className={`product-card__counter-value ${
              animarNumero ? "product-card__counter-value--animating" : ""
            } ${bloqueado ? 'opacity-30' : ''}`}>
              {cantidadVisible}
            </span>

            <button
              onClick={aumentar}
              disabled={bloqueado}
              aria-label="Aumentar cantidad"
              className={`product-card__counter-btn ${bloqueado || cantidadVisible >= restante ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              +
            </button>
          </div>
        </div>

        {limiteAlcanzado && (
          <p className="text-[10px] text-amber-500 font-bold text-center leading-tight" role="status">
            {MENSAJE_LIMITE_STOCK} ({enCarrito}/{stockDisponible})
          </p>
        )}

        {/* BOTÓN PRINCIPAL DE COMPRA */}
        <button
          onClick={handleAgregar}
          disabled={estaAgregando || bloqueado}
          className={`product-card__submit-btn ${
            bloqueado
              ? "bg-themeBorder text-themeTextMuted cursor-not-allowed opacity-50 border-none shadow-none"
              : estaAgregando
                ? "product-card__submit-btn--adding"
                : "product-card__submit-btn--idle"
          }`}
        >
          {sinStock ? "Agotado" : limiteAlcanzado ? "Stock máximo en carrito" : estaAgregando ? "¡Añadido! ✓" : "Agregar al carrito"}
        </button>
      </div>
    </div>
  );
});
