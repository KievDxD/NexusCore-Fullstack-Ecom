import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { Producto } from '../types';

const MAX_COMPARAR = 3;

interface ComparadorState {
  items: Producto[];
  modalAbierto: boolean;
  toggleComparar: (producto: Producto) => void;
  quitarDeComparador: (id: number) => void;
  limpiarComparador: () => void;
  setModalAbierto: (abierto: boolean) => void;
}

export const useComparadorStore = create<ComparadorState>()(
  persist(
    (set, get) => ({
      items: [],
      modalAbierto: false,

      toggleComparar: (producto) => {
        const actuales = get().items;
        const yaExiste = actuales.some((item) => item.id === producto.id);
        if (yaExiste) {
          set({ items: actuales.filter((item) => item.id !== producto.id) });
          toast.info(`Quitado del comparador: ${producto.nombre}`);
          return;
        }

        if (actuales.length >= MAX_COMPARAR) {
          toast.warning(`Máximo ${MAX_COMPARAR} productos en el comparador`, {
            description: 'Quita uno de los productos seleccionados para agregar otro.',
          });
          return;
        }

        const nuevos = [...actuales, producto];
        set({ items: nuevos });
        toast.success(`Agregado al comparador (${nuevos.length}/${MAX_COMPARAR})`, {
          description: nuevos.length >= 2 ? '¡Ya puedes abrir la comparativa lado a lado!' : 'Selecciona al menos 1 producto más para comparar.',
        });
      },

      quitarDeComparador: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      limpiarComparador: () => set({ items: [], modalAbierto: false }),
      setModalAbierto: (abierto) => set({ modalAbierto: abierto }),
    }),
    {
      name: 'nexus_comparador_v1',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Determina qué índices de producto ganan en una propiedad técnica específica para resaltarlos en verde
export function obtenerIndicesGanadores(clave: string, valores: (string | number | undefined)[]): number[] {
  const claveNorm = clave.toLowerCase();

  // Propiedades donde un número MENOR es mejor (ej. precio, latencia CL, tiempo de respuesta ms, consumo/TDP, ruido dB)
  const menorEsMejor =
    claveNorm.includes('precio') ||
    claveNorm.includes('latencia') ||
    claveNorm.includes('respuesta') ||
    claveNorm.includes('ruido') ||
    claveNorm.includes('consumo') ||
    claveNorm.includes('tdp');

  // Propiedades donde un número MAYOR es mejor
  const mayorEsMejor =
    claveNorm.includes('frecuencia') ||
    claveNorm.includes('núcleos') ||
    claveNorm.includes('nucleos') ||
    claveNorm.includes('hilos') ||
    claveNorm.includes('vram') ||
    claveNorm.includes('memoria') ||
    claveNorm.includes('capacidad') ||
    claveNorm.includes('lectura') ||
    claveNorm.includes('escritura') ||
    claveNorm.includes('potencia') ||
    claveNorm.includes('refresco') ||
    claveNorm.includes('dpi') ||
    claveNorm.includes('botones') ||
    claveNorm.includes('caché') ||
    claveNorm.includes('cache') ||
    claveNorm.includes('tamaño') ||
    claveNorm.includes('stock') ||
    claveNorm.includes('descuento');

  if (!menorEsMejor && !mayorEsMejor) return [];

  const numeros = valores.map((val) => {
    if (typeof val === 'number') return val;
    if (!val || val === '—') return null;
    const texto = String(val).replace(/,/g, '');
    // Si es TB, convertir a GB para comparar con justicia (ej. 1TB = 1000GB)
    const tbMatch = texto.match(/(\d+(?:\.\d+)?)\s*tb/i);
    if (tbMatch) return parseFloat(tbMatch[1]) * 1024;
    const numMatch = texto.match(/(\d+(?:\.\d+)?)/);
    return numMatch ? parseFloat(numMatch[1]) : null;
  });

  const validos = numeros.filter((n): n is number => n !== null && !isNaN(n));
  if (validos.length < 2) return [];

  // Si todos tienen el mismo valor, no hay un ganador único
  const todosIguales = validos.every((n) => n === validos[0]);
  if (todosIguales) return [];

  const mejorValor = menorEsMejor ? Math.min(...validos) : Math.max(...validos);
  const ganadores: number[] = [];
  numeros.forEach((n, idx) => {
    if (n === mejorValor) ganadores.push(idx);
  });
  return ganadores;
}

