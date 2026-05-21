import { useState } from "react";
import { useCarrito, type Producto } from "../hooks/useCarrito"; 
import { useSettings } from "../hooks/useSettings"; 
import { convertPrice, formatCurrency } from "../utils/currency";
import "./TarjetaProducto.css"; // 🛠️ Importación de tus estilos BEM oscuros

export default function TarjetaProducto({ producto }: { producto: Producto }) {
  const agregarProducto = useCarrito((state) => state.agregarProducto);
  const { currency, rates } = useSettings();

  // 💰 Lógica de moneda (Inalterada)
  const precioConvertido = convertPrice(producto.precio, currency, rates);
  const precioFormateado = formatCurrency(precioConvertido, currency);

  // 🔢 ESTADOS: Cantidad, Animación del botón y Animación del número
  const [cantidad, setCantidad] = useState(1);
  const [estaAgregando, setEstaAgregando] = useState(false);
  const [animarNumero, setAnimarNumero] = useState(false);

  const dispararAnimacionNumero = () => {
    setAnimarNumero(true);
    setTimeout(() => setAnimarNumero(false), 200);
  };

  const aumentar = () => {
    setCantidad(cantidad + 1);
    dispararAnimacionNumero();
  };

  const disminuir = () => {
    if (cantidad > 1) {
      setCantidad(cantidad - 1);
      dispararAnimacionNumero();
    }
  };

  const handleAgregar = () => {
    for (let i = 0; i < cantidad; i++) {
      agregarProducto(producto);
    }
    setEstaAgregando(true);
    setCantidad(1); 
    setTimeout(() => setEstaAgregando(false), 1000);
  };

  return (
    <div className="product-card">
      <div>
        {/* Contenedor de Imagen */}
        <div className="product-card__image-wrapper">
          <img 
            src={producto.imagen} 
            alt={producto.nombre} 
            className="product-card__image"
            onError={(e) => {
              // 🩹 Respaldo si la ruta local no carga
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=Hardware';
            }}
          />
        </div>
        
        {/* Textos Informativos */}
        <h3 className="product-card__title">{producto.nombre}</h3>
        <p className="product-card__price">{precioFormateado}</p>
      </div>

      <div className="product-card__actions">
        {/* CONTADOR DE CANTIDAD */}
        <div className="product-card__counter">
          <span className="product-card__counter-label">Cant.</span>
          
          <div className="product-card__counter-controls">
            <button 
              onClick={disminuir}
              className="product-card__counter-btn"
            >
              -
            </button>

            {/* Modificador dinámico basado en el estado 'animarNumero' */}
            <span className={`product-card__counter-value ${
              animarNumero ? "product-card__counter-value--animating" : ""
            }`}>
              {cantidad}
            </span>

            <button 
              onClick={aumentar}
              className="product-card__counter-btn"
            >
              +
            </button>
          </div>
        </div>

        {/* BOTÓN PRINCIPAL DE COMPRA */}
        <button 
          onClick={handleAgregar} 
          disabled={estaAgregando}
          /* Modificadores dinámicos basados en el estado 'estaAgregando' */
          className={`product-card__submit-btn ${
            estaAgregando 
              ? "product-card__submit-btn--adding" 
              : "product-card__submit-btn--idle"
          }`}
        >
          {estaAgregando ? "¡Añadido! ✓" : "Agregar al carrito"}
        </button>
      </div>
    </div>
  );
}