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
  const nombre = (p.nombre || '').toLowerCase().trim();

  // 1. Tarjeta Madre / Board (evaluar antes que CPU para evitar que descripciones que mencionan 'Ryzen' o 'procesador' clasifiquen la board erróneamente)
  if (
    explicitSlot === 'board' ||
    explicitSlot === 'motherboard' ||
    cat.includes('madre') ||
    cat.includes('board') ||
    nombre.includes('tarjeta madre') ||
    nombre.includes('motherboard') ||
    nombre.includes('placa madre') ||
    nombre.includes('placa base') ||
    Boolean(specs['Chipset']) ||
    /\b(b450|b550|b650|b760|x570|x670|z690|z790|a520|a620|h610)\b/i.test(nombre)
  ) {
    return { id: 'board', label: 'Tarjetas Madre (Board)', corto: 'Boards', grupo: 'Componentes' };
  }

  // 2. Cooler / Refrigeración (evaluar antes que CPU por la misma razón)
  if (
    explicitSlot === 'cooler' ||
    explicitSlot === 'disipador' ||
    cat.includes('cooler') ||
    cat.includes('refriger') ||
    cat.includes('disipad') ||
    nombre.includes('cooler') ||
    nombre.includes('disipador') ||
    nombre.includes('refrigeración') ||
    nombre.includes('refrigeracion') ||
    nombre.includes('noctua') ||
    nombre.includes('water cooling') ||
    nombre.includes('aio') ||
    nombre.includes('líquida') ||
    nombre.includes('liquida')
  ) {
    return { id: 'cooler', label: 'Refrigeración (Coolers)', corto: 'Coolers', grupo: 'Componentes' };
  }

  // 3. Memoria RAM
  if (
    explicitSlot === 'ram' ||
    cat.includes('ram') ||
    cat.includes('memoria') ||
    nombre.includes('memoria ram') ||
    nombre.includes('ram ') ||
    nombre.includes('ddr4') ||
    nombre.includes('ddr5') ||
    nombre.includes('vengeance') ||
    nombre.includes('fury') ||
    nombre.includes('trident')
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
    nombre.includes('tarjeta gráfica') ||
    nombre.includes('tarjeta grafica') ||
    nombre.includes('placa de video') ||
    nombre.includes('rtx') ||
    nombre.includes('geforce') ||
    nombre.includes('radeon') ||
    nombre.includes('gtx')
  ) {
    return { id: 'gpu', label: 'Tarjetas Gráficas (GPU)', corto: 'GPU', grupo: 'Componentes' };
  }

  // 5. Almacenamiento SSD / HDD
  if (
    explicitSlot === 'storage' ||
    cat.includes('almacenamiento') ||
    cat.includes('ssd') ||
    cat.includes('disco') ||
    nombre.includes('ssd') ||
    nombre.includes('nvme') ||
    nombre.includes('m.2') ||
    nombre.includes('disco duro') ||
    nombre.includes('almacenamiento') ||
    nombre.includes('hdd') ||
    nombre.includes('sata')
  ) {
    return { id: 'storage', label: 'Almacenamiento (SSD/HDD)', corto: 'Almacenamiento', grupo: 'Componentes' };
  }

  // 6. Fuente de Poder / PSU
  if (
    explicitSlot === 'psu' ||
    cat.includes('fuente') ||
    cat.includes('psu') ||
    nombre.includes('fuente de poder') ||
    nombre.includes('fuente') ||
    nombre.includes('80 plus') ||
    nombre.includes('80+') ||
    nombre.includes('power supply')
  ) {
    return { id: 'psu', label: 'Fuentes de Poder (PSU)', corto: 'Fuentes', grupo: 'Componentes' };
  }

  // 7. Gabinete / Chasis
  if (
    explicitSlot === 'case' ||
    cat.includes('gabinete') ||
    cat.includes('chasis') ||
    cat.includes('case') ||
    nombre.includes('gabinete') ||
    nombre.includes('chasis') ||
    nombre.includes('case') ||
    nombre.includes('nzxt h')
  ) {
    return { id: 'case', label: 'Gabinetes (Chasis)', corto: 'Gabinetes', grupo: 'Componentes' };
  }

  // 8. Procesador / CPU (con exclusión explícita de tarjetas madre y coolers)
  if (
    explicitSlot === 'cpu' ||
    explicitSlot === 'procesador' ||
    cat.includes('procesador') ||
    cat.includes('cpu') ||
    nombre.includes('procesador') ||
    nombre.includes('ryzen') ||
    nombre.includes('core i3') ||
    nombre.includes('core i5') ||
    nombre.includes('core i7') ||
    nombre.includes('core i9') ||
    nombre.includes('intel core') ||
    (Boolean(specs['Zócalo']) && !specs['Chipset'] && !nombre.includes('madre') && !nombre.includes('board'))
  ) {
    return { id: 'cpu', label: 'Procesadores (CPU)', corto: 'CPU', grupo: 'Componentes' };
  }

  // 9. Teclado
  if (
    explicitSlot === 'teclado' ||
    cat.includes('teclado') ||
    cat.includes('keyboard') ||
    nombre.includes('teclado') ||
    nombre.includes('keyboard')
  ) {
    return { id: 'teclado', label: 'Teclados', corto: 'Teclados', grupo: 'Periféricos' };
  }

  // 10. Mouse
  if (
    explicitSlot === 'mouse' ||
    cat.includes('mouse') ||
    cat.includes('raton') ||
    cat.includes('ratón') ||
    nombre.includes('mouse') ||
    nombre.includes('ratón') ||
    nombre.includes('raton')
  ) {
    return { id: 'mouse', label: 'Mouses / Ratones', corto: 'Mouses', grupo: 'Periféricos' };
  }

  // 11. Monitor
  if (
    explicitSlot === 'monitor' ||
    cat.includes('monitor') ||
    cat.includes('pantalla') ||
    nombre.includes('monitor') ||
    nombre.includes('pantalla')
  ) {
    return { id: 'monitor', label: 'Monitores', corto: 'Monitores', grupo: 'Periféricos' };
  }

  // 12. Audio
  if (
    explicitSlot === 'audio' ||
    cat.includes('audio') ||
    cat.includes('auricular') ||
    cat.includes('audifono') ||
    nombre.includes('auricular') ||
    nombre.includes('headset') ||
    nombre.includes('audifono') ||
    nombre.includes('audífono')
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

        // Bloqueo estricto: no se pueden mezclar categorías diferentes (ej. CPU con Motherboard o RAM)
        if (actuales.length > 0) {
          const tipoActual = obtenerTipoProducto(actuales[0]);
          const tipoNuevo = obtenerTipoProducto(producto);

          if (tipoActual.id !== tipoNuevo.id) {
            toast.info(`Solo puedes comparar ${tipoActual.label}. Limpia el comparador para cambiar.`);
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

