import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Moneda = 'COP' | 'USD' | 'MXN';

interface SettingsState {
  backgroundColor: string;
  currency: Moneda;
  // 🇨🇴 Agregamos COP al tipado para que la aplicación no falle al leer la moneda local
  rates: { COP: number; USD: number; MXN: number }; 
  setSettings: (settings: Partial<Omit<SettingsState, 'setSettings' | 'fetchRates'>>) => void;
  setCurrency: (currency: Moneda) => void;
  fetchRates: () => Promise<void>;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      backgroundColor: 'bg-slate-50',
      currency: 'COP', // Moneda principal por defecto al entrar
      
      // Valores iniciales de seguridad (COP siempre arranca en 1)
      rates: { COP: 1, USD: 0.00025, MXN: 0.0042 }, 
      
      setSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      setCurrency: (currency) => set({ currency }),
      
      fetchRates: async () => {
        try {
          // Consultamos la API usando COP como moneda base
          const res = await fetch('https://open.er-api.com/v6/latest/COP');
          const data = await res.json();
          
          if (data && data.rates) {
            set({ 
              rates: { 
                COP: 1, // La moneda base siempre es 1 respecto a sí misma
                USD: data.rates.USD || 0.00025, 
                MXN: data.rates.MXN || 0.0042 
              } 
            });
          }
        } catch (error) {
          console.error("Error cargando tasas:", error);
        }
      },
    }),
    { name: 'ecommerce-settings' }
  )
);