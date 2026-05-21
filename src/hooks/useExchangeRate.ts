import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ⚠️ IMPORTANTE: Los tipos deben ser exactos para que no den error
export type Moneda = 'COP' | 'USD' | 'MXN';

interface SettingsState {
  currency: Moneda;
  rates: { USD: number; MXN: number }; // Esto arregla el error de la línea 14
  setCurrency: (currency: Moneda) => void;
  fetchRates: () => Promise<void>;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'COP',
      rates: { USD: 0.00025, MXN: 0.0042 }, // Valores iniciales
      setCurrency: (currency) => set({ currency }),
      fetchRates: async () => {
        try {
          const res = await fetch('https://open.er-api.com/v6/latest/COP');
          const data = await res.json();
          set({ rates: { USD: data.rates.USD, MXN: data.rates.MXN } });
        } catch (error) {
          console.error("Error en tasas:", error);
        }
      },
    }),
    { name: 'ecommerce-settings' }
  )
);