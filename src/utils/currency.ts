import { type Moneda } from '../hooks/useSettings';

const CURRENCY_CONFIG = {
  COP: { locale: 'es-CO', symbol: 'COP' },
  USD: { locale: 'en-US', symbol: 'USD' },
  MXN: { locale: 'es-MX', symbol: 'MXN' },
};

/**
 * Convierte un precio base en COP a la moneda seleccionada usando las tasas de la API
 */
export const convertPrice = (priceInCOP: number, targetCurrency: Moneda, rates: { USD: number; MXN: number }) => {
  if (targetCurrency === 'USD') return priceInCOP * rates.USD;
  if (targetCurrency === 'MXN') return priceInCOP * rates.MXN;
  return priceInCOP;
};

/**
 * Formatea un número como moneda profesional (puntos, comas y símbolos)
 */
export const formatCurrency = (amount: number, currency: Moneda) => {
  const config = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.symbol,
    minimumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount);
};