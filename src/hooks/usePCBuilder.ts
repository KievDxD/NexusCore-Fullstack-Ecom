import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Producto, PCBuilderSlot } from '../types';

export interface PasoBuilderInfo {
  slot: PCBuilderSlot;
  titulo: string;
  corto: string;
  obligatorio: boolean;
  descripcion: string;
}

export const PASOS_PC_BUILDER: PasoBuilderInfo[] = [
  { slot: 'cpu', titulo: 'Procesador (CPU)', corto: 'CPU', obligatorio: true, descripcion: 'Define el socket y la arquitectura base del ensamble.' },
  { slot: 'board', titulo: 'Tarjeta Madre (Board)', corto: 'Board', obligatorio: true, descripcion: 'Debe coincidir con el socket del procesador elegido.' },
  { slot: 'ram', titulo: 'Memoria RAM', corto: 'RAM', obligatorio: true, descripcion: 'Filtrada según el estándar DDR4 o DDR5 de la placa madre.' },
  { slot: 'gpu', titulo: 'Tarjeta Gráfica (GPU)', corto: 'GPU', obligatorio: false, descripcion: 'Potencia gráfica para gaming, renderizado e IA.' },
  { slot: 'storage', titulo: 'Almacenamiento NVMe / SSD', corto: 'SSD', obligatorio: true, descripcion: 'Unidad de estado sólido para sistema operativo y juegos.' },
  { slot: 'cooler', titulo: 'Refrigeración CPU', corto: 'Cooler', obligatorio: false, descripcion: 'Disipación térmica compatible con el socket seleccionado.' },
  { slot: 'case', titulo: 'Gabinete (Chasis)', corto: 'Chasis', obligatorio: false, descripcion: 'Soporte físico para el factor de forma de la tarjeta madre.' },
  { slot: 'psu', titulo: 'Fuente de Poder (PSU)', corto: 'Fuente', obligatorio: true, descripcion: 'Calculada automáticamente según el consumo total en Watts.' },
];

export interface SpecsNormalizadas {
  slot: PCBuilderSlot | null;
  socket: string | null;
  ramType: 'DDR4' | 'DDR5' | null;
  formFactor: 'ATX' | 'Micro-ATX' | 'Mini-ITX' | null;
  supportedFormFactors: string[];
  supportedSockets: string[];
  tdpWatts: number;
  psuWatts: number | null;
}

export interface ResultadoCompatibilidad {
  compatible: boolean;
  motivos: string[];
  etiquetas: string[];
}

export function detectarSlotProducto(p: Producto): PCBuilderSlot | null {
  const specs = p.especificaciones ?? {};
  const explicitSlot = (specs['tipo_componente'] || specs['slot'] || '').toLowerCase().trim();
  if (
    explicitSlot === 'cpu' ||
    explicitSlot === 'board' ||
    explicitSlot === 'ram' ||
    explicitSlot === 'gpu' ||
    explicitSlot === 'storage' ||
    explicitSlot === 'cooler' ||
    explicitSlot === 'case' ||
    explicitSlot === 'psu'
  ) {
    return explicitSlot;
  }

  const texto = `${p.nombre} ${p.descripcion}`.toLowerCase();
  if (texto.includes('procesador') || texto.includes('ryzen') || texto.includes('core i')) return 'cpu';
  if (texto.includes('tarjeta madre') || texto.includes('motherboard') || texto.includes('b550') || texto.includes('b650') || texto.includes('z790')) return 'board';
  if (texto.includes('ram ') || texto.includes('memoria ram') || texto.includes('vengeance') || texto.includes('ddr4') || texto.includes('ddr5')) return 'ram';
  if (texto.includes('tarjeta gráfica') || texto.includes('tarjeta grafica') || texto.includes('rtx') || texto.includes('radeon') || texto.includes('geforce')) return 'gpu';
  if (texto.includes('ssd') || texto.includes('nvme') || texto.includes('m.2')) return 'storage';
  if (texto.includes('cooler') || texto.includes('disipador') || texto.includes('noctua') || texto.includes('líquida')) return 'cooler';
  if (texto.includes('gabinete') || texto.includes('chasis') || texto.includes('nzxt h')) return 'case';
  if (texto.includes('fuente') || texto.includes('80+') || texto.includes('80 plus') || texto.includes('evga 600w')) return 'psu';

  return null;
}

function parseWatts(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{2,4})\s*w/i) || raw.match(/^(\d{2,4})$/);
  return match ? parseInt(match[1], 10) : null;
}

export function extraerSpecsHardware(p: Producto): SpecsNormalizadas {
  const slot = detectarSlotProducto(p);
  const specs = p.especificaciones ?? {};
  const todoTexto = `${p.nombre} ${p.descripcion} ${Object.entries(specs).map(([k, v]) => `${k}:${v}`).join(' ')}`.toUpperCase();

  // 1. Socket
  let socket: string | null = null;
  const rawSocket = (specs['Zócalo'] || specs['Socket'] || specs['socket'] || '').toUpperCase().trim();
  if (rawSocket) {
    socket = rawSocket;
  } else if (todoTexto.includes('AM5')) {
    socket = 'AM5';
  } else if (todoTexto.includes('AM4')) {
    socket = 'AM4';
  } else if (todoTexto.includes('LGA1700') || todoTexto.includes('LGA 1700')) {
    socket = 'LGA1700';
  } else if (todoTexto.includes('LGA1200') || todoTexto.includes('LGA 1200')) {
    socket = 'LGA1200';
  }

  // 2. Tipo de RAM
  let ramType: 'DDR4' | 'DDR5' | null = null;
  if (todoTexto.includes('DDR5')) {
    ramType = 'DDR5';
  } else if (todoTexto.includes('DDR4')) {
    ramType = 'DDR4';
  } else if (socket === 'AM5') {
    ramType = 'DDR5';
  } else if (socket === 'AM4') {
    ramType = 'DDR4';
  }

  // 3. Factor de forma
  let formFactor: 'ATX' | 'Micro-ATX' | 'Mini-ITX' | null = null;
  const rawForm = (specs['Factor de forma'] || specs['Formato'] || specs['form_factor'] || '').toUpperCase();
  if (rawForm.includes('MICRO-ATX') || rawForm.includes('MATX')) {
    formFactor = 'Micro-ATX';
  } else if (rawForm.includes('MINI-ITX') || rawForm.includes('ITX')) {
    formFactor = 'Mini-ITX';
  } else if (rawForm.includes('ATX') || rawForm.includes('MID-TOWER')) {
    formFactor = 'ATX';
  }

  const supportedFormFactors: string[] = [];
  if (todoTexto.includes('ATX')) supportedFormFactors.push('ATX');
  if (todoTexto.includes('MICRO-ATX')) supportedFormFactors.push('Micro-ATX');
  if (todoTexto.includes('MINI-ITX')) supportedFormFactors.push('Mini-ITX');

  const supportedSockets: string[] = [];
  ['AM5', 'AM4', 'LGA1700', 'LGA1200', 'LGA115X'].forEach((s) => {
    if (todoTexto.includes(s)) supportedSockets.push(s);
  });

  // 4. Consumo energético (TDP Watts) y Potencia de Fuente (PSU Watts)
  const explicitTdp =
    parseWatts(specs['TDP']) ??
    parseWatts(specs['Consumo']) ??
    parseWatts(specs['tdp_watts']);

  const explicitPsu =
    slot === 'psu'
      ? parseWatts(specs['Potencia']) ?? parseWatts(specs['psu_watts']) ?? parseWatts(p.nombre)
      : null;

  const defaultTdpBySlot: Record<PCBuilderSlot, number> = {
    cpu: 85,
    board: 35,
    ram: 10,
    gpu: 160,
    storage: 8,
    cooler: 10,
    case: 10,
    psu: 0,
  };

  const tdpWatts = slot === 'psu' ? 0 : (explicitTdp ?? (slot ? defaultTdpBySlot[slot] : 15));

  return {
    slot,
    socket,
    ramType,
    formFactor,
    supportedFormFactors,
    supportedSockets,
    tdpWatts,
    psuWatts: explicitPsu,
  };
}

export function calcularConsumoEnsamble(seleccion: Partial<Record<PCBuilderSlot, Producto>>): {
  consumoTotalWatts: number;
  fuenteRecomendadaWatts: number;
} {
  let sumaWatts = 0;
  (Object.entries(seleccion) as [PCBuilderSlot, Producto | undefined][]).forEach(([slot, prod]) => {
    if (!prod || slot === 'psu') return;
    const s = extraerSpecsHardware(prod);
    sumaWatts += s.tdpWatts;
  });

  // Margen de seguridad del 25% + 40W base para periféricos/ventiladores, redondeado a múltiplos de 50W
  const baseRecomendada = sumaWatts > 0 ? Math.ceil(((sumaWatts + 40) * 1.25) / 50) * 50 : 450;
  return {
    consumoTotalWatts: sumaWatts,
    fuenteRecomendadaWatts: Math.max(450, baseRecomendada),
  };
}

export function evaluarCompatibilidadPieza(
  slot: PCBuilderSlot,
  candidato: Producto,
  seleccion: Partial<Record<PCBuilderSlot, Producto>>
): ResultadoCompatibilidad {
  const candSpecs = extraerSpecsHardware(candidato);
  const motivos: string[] = [];
  const etiquetas: string[] = [];

  if (candSpecs.socket) etiquetas.push(`Socket ${candSpecs.socket}`);
  if (candSpecs.ramType) etiquetas.push(candSpecs.ramType);
  if (candSpecs.formFactor) etiquetas.push(candSpecs.formFactor);
  if (slot === 'psu' && candSpecs.psuWatts) etiquetas.push(`${candSpecs.psuWatts}W`);
  else if (candSpecs.tdpWatts > 0) etiquetas.push(`${candSpecs.tdpWatts}W TDP`);

  const cpu = seleccion.cpu ? extraerSpecsHardware(seleccion.cpu) : null;
  const board = seleccion.board ? extraerSpecsHardware(seleccion.board) : null;
  const ram = seleccion.ram ? extraerSpecsHardware(seleccion.ram) : null;

  // Regla 1: CPU vs Board (Socket)
  if (slot === 'board' && cpu?.socket && candSpecs.socket && cpu.socket !== candSpecs.socket) {
    motivos.push(`Requiere socket ${cpu.socket} (esta placa es ${candSpecs.socket})`);
  }
  if (slot === 'cpu' && board?.socket && candSpecs.socket && board.socket !== candSpecs.socket) {
    motivos.push(`La placa seleccionada usa socket ${board.socket} (este CPU es ${candSpecs.socket})`);
  }

  // Regla 2: RAM vs Board / CPU (DDR4 vs DDR5)
  const requiredRam = board?.ramType ?? cpu?.ramType;
  if (slot === 'ram' && requiredRam && candSpecs.ramType && requiredRam !== candSpecs.ramType) {
    motivos.push(`El ensamble requiere memoria ${requiredRam} (este kit es ${candSpecs.ramType})`);
  }
  if (slot === 'board' && ram?.ramType && candSpecs.ramType && ram.ramType !== candSpecs.ramType) {
    motivos.push(`Incompatible con la RAM ${ram.ramType} seleccionada`);
  }

  // Regla 3: Cooler vs Socket activo
  const socketActivo = cpu?.socket ?? board?.socket;
  if (
    slot === 'cooler' &&
    socketActivo &&
    candSpecs.supportedSockets.length > 0 &&
    !candSpecs.supportedSockets.includes(socketActivo)
  ) {
    motivos.push(`Cooler sin soporte declarado para socket ${socketActivo}`);
  }

  // Regla 4: Gabinete vs Factor de forma de la Board
  if (
    slot === 'case' &&
    board?.formFactor &&
    candSpecs.supportedFormFactors.length > 0 &&
    !candSpecs.supportedFormFactors.includes(board.formFactor)
  ) {
    motivos.push(`El gabinete no soporta placas ${board.formFactor}`);
  }

  // Regla 5: Fuente de Poder (PSU) vs Consumo estimado en Watts
  if (slot === 'psu' && candSpecs.psuWatts) {
    const { fuenteRecomendadaWatts, consumoTotalWatts } = calcularConsumoEnsamble(seleccion);
    if (candSpecs.psuWatts < consumoTotalWatts + 40) {
      motivos.push(`Potencia insuficiente (${candSpecs.psuWatts}W < ${fuenteRecomendadaWatts}W recomendados)`);
    }
  }

  return {
    compatible: motivos.length === 0,
    motivos,
    etiquetas,
  };
}

interface PCBuilderState {
  seleccion: Partial<Record<PCBuilderSlot, Producto>>;
  pasoActual: PCBuilderSlot;
  soloCompatibles: boolean;
  seleccionarPieza: (slot: PCBuilderSlot, producto: Producto) => void;
  quitarPieza: (slot: PCBuilderSlot) => void;
  setPasoActual: (slot: PCBuilderSlot) => void;
  setSoloCompatibles: (valor: boolean) => void;
  reiniciarBuilder: () => void;
}

export const usePCBuilderStore = create<PCBuilderState>()(
  persist(
    (set) => ({
      seleccion: {},
      pasoActual: 'cpu',
      soloCompatibles: true,

      seleccionarPieza: (slot, producto) =>
        set((state) => {
          const nuevaSeleccion = { ...state.seleccion, [slot]: producto };
          const idxActual = PASOS_PC_BUILDER.findIndex((p) => p.slot === slot);
          const siguientePaso =
            idxActual >= 0 && idxActual < PASOS_PC_BUILDER.length - 1
              ? PASOS_PC_BUILDER[idxActual + 1].slot
              : state.pasoActual;
          return {
            seleccion: nuevaSeleccion,
            pasoActual: siguientePaso,
          };
        }),

      quitarPieza: (slot) =>
        set((state) => {
          const copia = { ...state.seleccion };
          delete copia[slot];
          return { seleccion: copia };
        }),

      setPasoActual: (slot) => set({ pasoActual: slot }),
      setSoloCompatibles: (valor) => set({ soloCompatibles: valor }),
      reiniciarBuilder: () => set({ seleccion: {}, pasoActual: 'cpu' }),
    }),
    {
      name: 'nexus_pc_builder_v1',
    }
  )
);

