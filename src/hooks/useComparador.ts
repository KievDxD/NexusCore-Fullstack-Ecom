import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { Producto } from '../types';

const MAX_COMPARAR = 3;

export interface TipoProductoInfo {
  id: string;
  label: string;
}

export function obtenerTipoProducto(p: Producto): TipoProductoInfo {
  const specs = p.especificaciones ?? {};
  const explicitSlot = (specs['tipo_componente'] || specs['slot'] || specs['tipo'] || '').toLowerCase().trim();
  const texto = `${p.nombre} ${p.descripcion} ${p.categoria}`.toLowerCase();

  // 1. Procesador / CPU
  if (
    explicitSlot === 'cpu' ||
    explicitSlot === 'procesador' ||
    texto.includes('procesador') ||
    texto.includes('ryzen') ||
    texto.includes('core i3') ||
    texto.includes('core i5') ||
    texto.includes('core i7') ||
    texto.includes('core i9') ||
    texto.includes('intel core') ||
    (Boolean(specs['Zócalo']) && !texto.includes('tarjeta madre') && !texto.includes('motherboard') && !texto.includes('cooler') && !texto.includes('disipador'))
  ) {
    return { id: 'cpu', label: 'Procesadores (CPU)' };
  }

  // 2. Tarjeta Madre / Board
  if (
    explicitSlot === 'board' ||
    explicitSlot === 'motherboard' ||
    texto.includes('tarjeta madre') ||
    texto.includes('motherboard') ||
    texto.includes('placa madre') ||
    texto.includes('placa base') ||
    texto.includes('b550') ||
    texto.includes('b650') ||
    texto.includes('x670') ||
    texto.includes('z790') ||
    texto.includes('b760')
  ) {
    return { id: 'board', label: 'Tarjetas Madre' };
  }

  // 3. Memoria RAM
  if (
    explicitSlot === 'ram' ||
    texto.includes('memoria ram') ||
    texto.includes('ram ') ||
    texto.includes('ddr4') ||
    texto.includes('ddr5') ||
    texto.includes('vengeance')
  ) {
    return { id: 'ram', label: 'Memorias RAM' };
  }

  // 4. Tarjeta Gráfica / GPU
  if (
    explicitSlot === 'gpu' ||
    texto.includes('tarjeta gráfica') ||
    texto.includes('tarjeta grafica') ||
    texto.includes('placa de video') ||
    texto.includes('rtx') ||
    texto.includes('geforce') ||
    texto.includes('radeon') ||
    texto.includes('gtx')
  ) {
    return { id: 'gpu', label: 'Tarjetas Gráficas (GPU)' };
  }

  // 5. Almacenamiento SSD / HDD
  if (
    explicitSlot === 'storage' ||
    texto.includes('ssd') ||
    texto.includes('nvme') ||
    texto.includes('m.2') ||
    texto.includes('disco duro') ||
    texto.includes('almacenamiento')
  ) {
    return { id: 'storage', label: 'Almacenamiento (SSD/HDD)' };
  }

  // 6. Refrigeración / Cooler
  if (
    explicitSlot === 'cooler' ||
    texto.includes('cooler') ||
    texto.includes('disipador') ||
    texto.includes('noctua') ||
    texto.includes('refrigeración') ||
    texto.includes('refrigeracion') ||
    texto.includes('líquida') ||
    texto.includes('liquida')
  ) {
    return { id: 'cooler', label: 'Refrigeración (Coolers)' };
  }

  // 7. Fuente de Poder / PSU
  if (
    explicitSlot === 'psu' ||
    texto.includes('fuente de poder') ||
    texto.includes('fuente') ||
    texto.includes('80 plus') ||
    texto.includes('80+') ||
    texto.includes('power supply')
  ) {
    return { id: 'psu', label: 'Fuentes de Poder (PSU)' };
  }

  // 8. Gabinete / Chasis
  if (
    explicitSlot === 'case' ||
    texto.includes('gabinete') ||
    texto.includes('chasis') ||
    texto.includes('case') ||
    texto.includes('nzxt h')
  ) {
    return { id: 'case', label: 'Gabinetes / Chasis' };
  }

  // 9. Teclado
  if (
    explicitSlot === 'teclado' ||
    texto.includes('teclado') ||
    texto.includes('keyboard')
  ) {
    return { id: 'teclado', label: 'Teclados' };
  }

  // 10. Mouse
  if (
    explicitSlot === 'mouse' ||
    texto.includes('mouse') ||
    texto.includes('ratón') ||
    texto.includes('raton')
  ) {
    return { id: 'mouse', label: 'Mouses / Ratones' };
  }

  // 11. Monitor
  if (
    explicitSlot === 'monitor' ||
    texto.includes('monitor') ||
    texto.includes('pantalla')
  ) {
    return { id: 'monitor', label: 'Monitores' };
  }

  // 12. Audio
  if (
    explicitSlot === 'audio' ||
    texto.includes('auricular') ||
    texto.includes('headset') ||
    texto.includes('audifono') ||
    texto.includes('audífono')
  ) {
    return { id: 'audio', label: 'Audio / Auriculares' };
  }

  const cat = p.categoria?.trim() || 'Componentes';
  return {
    id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
    label: cat,
  };
}

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

        // Restricción: comparar solo componentes del mismo tipo
        if (actuales.length > 0) {
          const tipoActual = obtenerTipoProducto(actuales[0]);
          const tipoNuevo = obtenerTipoProducto(producto);

          if (tipoActual.id !== tipoNuevo.id) {
            toast.warning('Solo puedes comparar componentes del mismo tipo', {
              description: `Actualmente comparas ${tipoActual.label}. No tiene sentido comparar con ${tipoNuevo.label}.`,
              action: {
                label: `Comparar ${tipoNuevo.label}`,
                onClick: () => {
                  set({ items: [producto] });
                  toast.success(`Iniciando comparativa de ${tipoNuevo.label}`, {
                    description: `1/${MAX_COMPARAR}: ${producto.nombre}`,
                  });
                },
              },
            });
            return;
          }
        }

        if (actuales.length >= MAX_COMPARAR) {
          toast.warning(`Máximo ${MAX_COMPARAR} productos en el comparador`, {
            description: 'Quita uno de los productos seleccionados para agregar otro.',
          });
          return;
        }

        const nuevos = [...actuales, producto];
        const tipo = obtenerTipoProducto(producto);
        set({ items: nuevos });
        toast.success(`Agregado al comparador (${nuevos.length}/${MAX_COMPARAR})`, {
          description: nuevos.length >= 2 ? `¡Comparativa de ${tipo.label} lista para abrir!` : `Selecciona otro producto de ${tipo.label} para comparar.`,
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
      onRehydrateStorage: () => (state) => {
        // Sanitizar en rehidratación por si existían productos de tipos heterogéneos previos
        if (state && state.items.length > 1) {
          const primerTipo = obtenerTipoProducto(state.items[0]).id;
          state.items = state.items.filter((item) => obtenerTipoProducto(item).id === primerTipo);
        }
      },
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

