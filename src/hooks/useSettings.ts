import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Moneda } from '../types';

export type { Moneda };

// Las tasas se refrescan como máximo cada 6 horas
const RATES_TTL_MS = 6 * 60 * 60 * 1000;

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
  fetchRates: () => Promise<void>;
}

const isValidRate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      backgroundColor: 'bg-slate-50',
      currency: 'COP',
      // Valores iniciales de seguridad (COP siempre arranca en 1)
      rates: { COP: 1, USD: 0.00025, MXN: 0.0042 },
      ratesUpdatedAt: 0,
      whatsappNumber: '573043104831',

      setSettings: (newSettings) => set(newSettings),
      setCurrency: (currency) => set({ currency }),
      setWhatsappNumber: (whatsappNumber) => set({ whatsappNumber }),

      fetchRates: async () => {
        if (Date.now() - get().ratesUpdatedAt < RATES_TTL_MS) return;
        try {
          const res = await fetch('https://open.er-api.com/v6/latest/COP');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: { rates?: Record<string, unknown> } = await res.json();
          const usd = data.rates?.USD;
          const mxn = data.rates?.MXN;

          if (isValidRate(usd) && isValidRate(mxn)) {
            set({ rates: { COP: 1, USD: usd, MXN: mxn }, ratesUpdatedAt: Date.now() });
          }
        } catch (error) {
          console.error('Error cargando tasas:', error);
        }
      },
    }),
    { name: 'ecommerce-settings' }
  )
);
