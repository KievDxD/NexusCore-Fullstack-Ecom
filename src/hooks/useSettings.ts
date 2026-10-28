import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Moneda } from '../types';

export type { Moneda };

// Las tasas se refrescan cada 1 hora o al cambiar de día
const RATES_TTL_MS = 60 * 60 * 1000;

interface SettingsValues {
  backgroundColor: string;
  currency: Moneda;
  rates: { COP: number; USD: number; MXN: number };
  ratesUpdatedAt: number;
  whatsappNumber: string;
}

interface SettingsState extends SettingsValues {
  setSettings: (settings: Partial<Pick<SettingsValues, 'backgroundColor' | 'currency' | 'whatsappNumber'>>) => void;
  setCurrency: (currency: Moneda) => void;
  setWhatsappNumber: (number: string) => void;
  fetchRates: (force?: boolean) => Promise<void>;
}

const isValidRate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const isSameDay = (ts1: number, ts2: number) => {
  if (!ts1 || !ts2) return false;
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

async function fetchLiveCopRates(): Promise<{ USD: number; MXN: number } | null> {
  // 1. Fuente primaria: fawazahmed0 currency-api (actualización diaria de alta precisión con soporte total COP)
  const primaryUrls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cop.json',
    'https://latest.currency-api.pages.dev/v1/currencies/cop.json',
  ];

  for (const url of primaryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data: { cop?: Record<string, unknown> } = await res.json();
      const usd = data.cop?.usd;
      const mxn = data.cop?.mxn;
      if (isValidRate(usd) && isValidRate(mxn)) {
        return { USD: usd, MXN: mxn };
      }
    } catch {
      // Continuar al siguiente fallback
    }
  }

  // 2. Fallback secundario: open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/COP', { cache: 'no-store' });
    if (res.ok) {
      const data: { rates?: Record<string, unknown> } = await res.json();
      const usd = data.rates?.USD;
      const mxn = data.rates?.MXN;
      if (isValidRate(usd) && isValidRate(mxn)) {
        return { USD: usd, MXN: mxn };
      }
    }
  } catch {
    // Ignorar error de red en fallback
  }

  return null;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      backgroundColor: 'bg-slate-50',
      currency: 'COP',
      // Valores iniciales de seguridad cercanos a la tasa actual (~4200 COP/USD, ~210 COP/MXN)
      rates: { COP: 1, USD: 0.000238, MXN: 0.00476 },
      ratesUpdatedAt: 0,
      whatsappNumber: '573043104831',

      setSettings: (newSettings) => {
        set(newSettings);
        if (newSettings.currency && newSettings.currency !== 'COP') {
          void get().fetchRates();
        }
      },
      setCurrency: (currency) => {
        set({ currency });
        if (currency !== 'COP') {
          void get().fetchRates();
        }
      },
      setWhatsappNumber: (whatsappNumber) => set({ whatsappNumber }),

      fetchRates: async (force = false) => {
        const { ratesUpdatedAt } = get();
        const now = Date.now();
        const freshWithinTtl = now - ratesUpdatedAt < RATES_TTL_MS && isSameDay(ratesUpdatedAt, now);
        if (!force && freshWithinTtl) return;

        const liveRates = await fetchLiveCopRates();
        if (liveRates) {
          set({
            rates: { COP: 1, USD: liveRates.USD, MXN: liveRates.MXN },
            ratesUpdatedAt: Date.now(),
          });
        }
      },
    }),
    { name: 'ecommerce-settings' }
  )
);
