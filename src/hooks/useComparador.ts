import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { Producto } from '../types';

const MAX_COMPARAR = 3;

export interface TipoProductoInfo {
  id: string;
  label: string;
  grupo: 'Componentes' | 'Periféricos';
  corto: string;
}

export const CATEGORIAS_PRODUCTO: TipoProductoInfo[] = [
  { id: 'cpu', label: 'Procesadores (CPU)', corto: 'CPU', grupo: 'Componentes' },
  { id: 'gpu', label: 'Tarjetas Gráficas (GPU)', corto: 'GPU', grupo: 'Componentes' },
  { id: 'ram', label: 'Memorias RAM', corto: 'RAM', grupo: 'Componentes' },
  { id: 'storage', label: 'Almacenamiento (SSD/HDD)', corto: 'Almacenamiento', grupo: 'Componentes' },
  { id: 'board', label: 'Tarjetas Madre (Board)', corto: 'Boards', grupo: 'Componentes' },
  { id: 'psu', label: 'Fuentes de Poder (PSU)', corto: 'Fuentes', grupo: 'Componentes' },
  { id: 'case', label: 'Gabinetes (Chasis)', corto: 'Gabinetes', grupo: 'Componentes' },
  { id: 'cooler', label: 'Refrigeración (Coolers)', corto: 'Coolers', grupo: 'Componentes' },
  { id: 'teclado', label: 'Teclados', corto: 'Teclados', grupo: 'Periféricos' },
  { id: 'mouse', label: 'Mouses / Ratones', corto: 'Mouses', grupo: 'Periféricos' },
  { id: 'monitor', label: 'Monitores', corto: 'Monitores', grupo: 'Periféricos' },
  { id: 'audio', label: 'Audio / Auriculares', corto: 'Audio', grupo: 'Periféricos' },
];

export function obtenerTipoProducto(p: Producto): TipoProductoInfo {
  const specs = p.especificaciones ?? {};
  const explicitSlot = (specs['tipo_componente'] || specs['slot'] || specs['tipo'] || '').toLowerCase().trim();
  const cat = (p.categoria || '').toLowerCase().trim();
  const texto = `${p.nombre} ${p.descripcion} ${cat}`.toLowerCase();

  // 1. Procesador / CPU
  if (
    explicitSlot === 'cpu' ||
    explicitSlot === 'procesador' ||
    cat.includes('procesador') ||
    cat.includes('cpu') ||
    texto.includes('procesador') ||
    texto.includes('ryzen') ||
    texto.includes('core i3') ||
    texto.includes('core i5') ||
    texto.includes('core i7') ||
    texto.includes('core i9') ||
    texto.includes('intel core') ||
    (Boolean(specs['Zócalo']) && !texto.includes('tarjeta madre') && !texto.includes('motherboard') && !texto.includes('cooler') && !texto.includes('disipador'))
  ) {
    return { id: 'cpu', label: 'Procesadores (CPU)', corto: 'CPU', grupo: 'Componentes' };
  }

  // 2. Tarjeta Madre / Board
  if (
    explicitSlot === 'board' ||
    explicitSlot === 'motherboard' ||
    cat.includes('madre') ||
    cat.includes('board') ||
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
    return { id: 'board', label: 'Tarjetas Madre (Board)', corto: 'Boards', grupo: 'Componentes' };
  }

  // 3. Memoria RAM
  if (
    explicitSlot === 'ram' ||
    cat.includes('ram') ||
    cat.includes('memoria') ||
    texto.includes('memoria ram') ||
    texto.includes('ram ') ||
    texto.includes('ddr4') ||
    texto.includes('ddr5') ||
    texto.includes('vengeance')
  ) {
    return { id: 'ram', label: 'Memorias RAM', corto: 'RAM', grupo: 'Componentes' };
  }

  // 4. Tarjeta Gráfica / GPU
  if (
    explicitSlot === 'gpu' ||
    cat.includes('gráfica') ||
    cat.includes('grafica') ||
    cat.includes('gpu') ||
    cat.includes('video') ||
    texto.includes('tarjeta gráfica') ||
    texto.includes('tarjeta grafica') ||
    texto.includes('placa de video') ||
    texto.includes('rtx') ||
    texto.includes('geforce') ||
    texto.includes('radeon') ||
    texto.includes('gtx')
  ) {
    return { id: 'gpu', label: 'Tarjetas Gráficas (GPU)', corto: 'GPU', grupo: 'Componentes' };
  }

  // 5. Almacenamiento SSD / HDD
  if (
    explicitSlot === 'storage' ||
    cat.includes('almacenamiento') ||
    cat.includes('ssd') ||
    cat.includes('disco') ||
    texto.includes('ssd') ||
    texto.includes('nvme') ||
    texto.includes('m.2') ||
    texto.includes('disco duro') ||
    texto.includes('almacenamiento')
  ) {
    return { id: 'storage', label: 'Almacenamiento (SSD/HDD)', corto: 'Almacenamiento', grupo: 'Componentes' };
  }

  // 6. Refrigeración / Cooler
  if (
    explicitSlot === 'cooler' ||
    cat.includes('cooler') ||
    cat.includes('refrigeración') ||
    cat.includes('disipador') ||
    texto.includes('cooler') ||
    texto.includes('disipador') ||
    texto.includes('noctua') ||
    texto.includes('refrigeración') ||
    texto.includes('refrigeracion') ||
    texto.includes('líquida') ||
    texto.includes('liquida')
  ) {
    return { id: 'cooler', label: 'Refrigeración (Coolers)', corto: 'Coolers', grupo: 'Componentes' };
  }

  // 7. Fuente de Poder / PSU
  if (
    explicitSlot === 'psu' ||
    cat.includes('fuente') ||
    cat.includes('psu') ||
    texto.includes('fuente de poder') ||
    texto.includes('fuente') ||
    texto.includes('80 plus') ||
    texto.includes('80+') ||
    texto.includes('power supply')
  ) {
    return { id: 'psu', label: 'Fuentes de Poder (PSU)', corto: 'Fuentes', grupo: 'Componentes' };
  }

  // 8. Gabinete / Chasis
  if (
    explicitSlot === 'case' ||
    cat.includes('gabinete') ||
    cat.includes('chasis') ||
    cat.includes('case') ||
    texto.includes('gabinete') ||
    texto.includes('chasis') ||
    texto.includes('case') ||
    texto.includes('nzxt h')
  ) {
    return { id: 'case', label: 'Gabinetes (Chasis)', corto: 'Gabinetes', grupo: 'Componentes' };
  }

  // 9. Teclado
  if (
    explicitSlot === 'teclado' ||
    cat.includes('teclado') ||
    cat.includes('keyboard') ||
    texto.includes('teclado') ||
    texto.includes('keyboard')
  ) {
    return { id: 'teclado', label: 'Teclados', corto: 'Teclados', grupo: 'Periféricos' };
  }

  // 10. Mouse
  if (
    explicitSlot === 'mouse' ||
    cat.includes('mouse') ||
    cat.includes('raton') ||
    cat.includes('ratón') ||
    texto.includes('mouse') ||
    texto.includes('ratón') ||
    texto.includes('raton')
  ) {
    return { id: 'mouse', label: 'Mouses / Ratones', corto: 'Mouses', grupo: 'Periféricos' };
  }

  // 11. Monitor
  if (
    explicitSlot === 'monitor' ||
    cat.includes('monitor') ||
    cat.includes('pantalla') ||
    texto.includes('monitor') ||
    texto.includes('pantalla')
  ) {
    return { id: 'monitor', label: 'Monitores', corto: 'Monitores', grupo: 'Periféricos' };
  }

  // 12. Audio
  if (
    explicitSlot === 'audio' ||
    cat.includes('audio') ||
    cat.includes('auricular') ||
    cat.includes('audifono') ||
    texto.includes('auricular') ||
    texto.includes('headset') ||
    texto.includes('audifono') ||
    texto.includes('audífono')
  ) {
    return { id: 'audio', label: 'Audio / Auriculares', corto: 'Audio', grupo: 'Periféricos' };
  }

  const esPeriferico = cat.includes('periférico') || cat.includes('periferico');
  const catLabel = p.categoria?.trim() || (esPeriferico ? 'Periféricos' : 'Componentes');
  return {
    id: `cat_${catLabel.toLowerCase().replace(/\s+/g, '_')}`,
    label: catLabel,
    corto: catLabel,
    grupo: esPeriferico ? 'Periféricos' : 'Componentes',
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

        // Si se elige un tipo diferente, cambiamos limpiamente a esa categoría sin mensajes intrusivos
        if (actuales.length > 0) {
          const tipoActual = obtenerTipoProducto(actuales[0]);
          const tipoNuevo = obtenerTipoProducto(producto);

          if (tipoActual.id !== tipoNuevo.id) {
            set({ items: [producto] });
            toast.info(`Comparando ${tipoNuevo.label}`);
            return;
          }
        }

        if (actuales.length >= MAX_COMPARAR) {
          toast.warning(`Máximo ${MAX_COMPARAR} productos en el comparador`);
          return;
        }

        const nuevos = [...actuales, producto];
        set({ items: nuevos });
        toast.success(`Agregado: ${producto.nombre} (${nuevos.length}/${MAX_COMPARAR})`);
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

