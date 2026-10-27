import type { Moneda, Producto } from '../types';

const CURRENCY_CONFIG: Record<Moneda, { locale: string; symbol: string }> = {
  COP: { locale: 'es-CO', symbol: 'COP' },
  USD: { locale: 'en-US', symbol: 'USD' },
  MXN: { locale: 'es-MX', symbol: 'MXN' },
};

// Intl.NumberFormat es costoso de instanciar: se cachea uno por moneda
const formatters = new Map<Moneda, Intl.NumberFormat>();

/**
 * Precio unitario final en COP aplicando el descuento del producto (0-100).
 * Única fuente de verdad para tarjeta, detalle, carrito y mensaje de WhatsApp.
 */
export const precioConDescuento = (p: Pick<Producto, 'precio' | 'descuento'>): number => {
  const descuento = Math.min(Math.max(p.descuento ?? 0, 0), 100);
  return descuento > 0 ? p.precio * (1 - descuento / 100) : p.precio;
};

/**
 * Convierte un precio base en COP a la moneda seleccionada usando las tasas de la API
 */
export const convertPrice = (
  priceInCOP: number,
  targetCurrency: Moneda,
  rates: { USD: number; MXN: number }
) => {
  if (targetCurrency === 'USD') return priceInCOP * rates.USD;
  if (targetCurrency === 'MXN') return priceInCOP * rates.MXN;
  return priceInCOP;
};

/**
 * Formatea un número como moneda profesional (puntos, comas y símbolos)
 */
export const formatCurrency = (amount: number, currency: Moneda) => {
  let formatter = formatters.get(currency);
  if (!formatter) {
    const config = CURRENCY_CONFIG[currency];
    formatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.symbol,
      minimumFractionDigits: currency === 'COP' ? 0 : 2,
    });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
};
