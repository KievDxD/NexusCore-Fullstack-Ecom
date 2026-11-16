import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Producto, PCBuilderSlot } from '../types';
import { supabase } from '../lib/supabase';
import { precioConDescuento } from '../utils/currency';

export interface UpgradeSugerido {
  slot: PCBuilderSlot;
  producto_actual_id?: number | null;
  producto_sugerido_id: number;
  producto_sugerido_nombre: string;
  precio_cop: number;
  razon_tecnica: string;
  ganancia_estimada: string;
}

export interface AnalisisEnsambleIA {
  puntuacion_balance: number;
  nivel_ensamble: 'Entry-Level' | 'Mid-Range Balanced' | 'High-End Gaming' | 'Workstation / Enthusiast';
  diagnostico_tecnico: string;
  cuello_botella_porcentaje: number;
  advertencias: string[];
  upgrades_sugeridos: UpgradeSugerido[];
  fuente_analisis: 'ai-llm' | 'heuristic-engine';
}

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

  const nombre = (p.nombre || '').toLowerCase();
  const cat = (p.categoria || '').toLowerCase();

  // Tarjeta Madre (evaluar antes de CPU para evitar que descripciones con 'Ryzen' o 'procesador' la clasifiquen como CPU)
  if (
    cat.includes('madre') ||
    cat.includes('board') ||
    nombre.includes('tarjeta madre') ||
    nombre.includes('motherboard') ||
    nombre.includes('placa madre') ||
    nombre.includes('placa base') ||
    Boolean(specs['Chipset']) ||
    /\b(b450|b550|b650|b760|x570|x670|z690|z790|a520|a620|h610)\b/i.test(nombre)
  ) {
    return 'board';
  }

  // Cooler
  if (
    cat.includes('cooler') ||
    cat.includes('refriger') ||
    nombre.includes('cooler') ||
    nombre.includes('disipador') ||
    nombre.includes('refrigeración') ||
    nombre.includes('refrigeracion') ||
    nombre.includes('noctua') ||
    nombre.includes('aio') ||
    nombre.includes('líquida')
  ) {
    return 'cooler';
  }

  // RAM
  if (
    cat.includes('ram') ||
    nombre.includes('ram ') ||
    nombre.includes('memoria ram') ||
    nombre.includes('ddr4') ||
    nombre.includes('ddr5') ||
    nombre.includes('vengeance')
  ) {
    return 'ram';
  }

  // GPU
  if (
    cat.includes('gráfica') ||
    cat.includes('grafica') ||
    cat.includes('gpu') ||
    nombre.includes('tarjeta gráfica') ||
    nombre.includes('tarjeta grafica') ||
    nombre.includes('rtx') ||
    nombre.includes('geforce') ||
    nombre.includes('radeon')
  ) {
    return 'gpu';
  }

  // Almacenamiento
  if (
    cat.includes('ssd') ||
    cat.includes('almacenamiento') ||
    nombre.includes('ssd') ||
    nombre.includes('nvme') ||
    nombre.includes('m.2')
  ) {
    return 'storage';
  }

  // Fuente
  if (
    cat.includes('fuente') ||
    cat.includes('psu') ||
    nombre.includes('fuente') ||
    nombre.includes('80 plus') ||
    nombre.includes('80+')
  ) {
    return 'psu';
  }

  // Gabinete
  if (
    cat.includes('gabinete') ||
    cat.includes('chasis') ||
    nombre.includes('gabinete') ||
    nombre.includes('chasis') ||
    nombre.includes('case') ||
    nombre.includes('nzxt h')
  ) {
    return 'case';
  }

  // Procesador
  if (
    cat.includes('procesador') ||
    cat.includes('cpu') ||
    nombre.includes('procesador') ||
    nombre.includes('ryzen') ||
    nombre.includes('core i') ||
    (Boolean(specs['Zócalo']) && !specs['Chipset'] && !nombre.includes('madre') && !nombre.includes('board'))
  ) {
    return 'cpu';
  }

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

function estimarTierCPU(cpu: Producto): number {
  const n = cpu.nombre.toLowerCase();
  if (n.includes('i9') || n.includes('ryzen 9') || n.includes('7950') || n.includes('14900')) return 9.2;
  if (n.includes('7800x3d') || n.includes('9800x3d')) return 9.5;
  if (n.includes('i7') || n.includes('ryzen 7') || n.includes('5800') || n.includes('7700')) return 7.4;
  if (n.includes('i5') || n.includes('ryzen 5') || n.includes('13400') || n.includes('5600') || n.includes('7600')) return 5.8;
  if (n.includes('i3') || n.includes('ryzen 3')) return 3.8;
  if (cpu.precio >= 1400000) return 8.2;
  if (cpu.precio >= 800000) return 6.8;
  if (cpu.precio >= 550000) return 5.2;
  return 4.0;
}

function estimarTierGPU(gpu: Producto): number {
  const n = gpu.nombre.toLowerCase();
  if (n.includes('4090') || n.includes('5090') || n.includes('7900 xtx')) return 9.8;
  if (n.includes('4080') || n.includes('5080') || n.includes('7900 xt')) return 8.9;
  if (n.includes('4070') || n.includes('7800 xt') || n.includes('3080')) return 7.6;
  if (n.includes('4060 ti') || n.includes('7700 xt') || n.includes('3070')) return 6.5;
  if (n.includes('4060') || n.includes('3060') || n.includes('7600') || n.includes('6600')) return 5.6;
  if (n.includes('3050') || n.includes('1660') || n.includes('1650')) return 3.6;
  if (gpu.precio >= 3200000) return 8.5;
  if (gpu.precio >= 1800000) return 6.8;
  if (gpu.precio >= 1200000) return 5.5;
  return 4.2;
}

export function analizarEnsambleDeterministico(
  seleccion: Partial<Record<PCBuilderSlot, Producto>>,
  catalogo: Producto[]
): AnalisisEnsambleIA {
  const disponibles = catalogo.filter((p) => (p.stock ?? 0) > 0);
  const advertencias: string[] = [];
  const upgrades: UpgradeSugerido[] = [];

  const cpu = seleccion.cpu;
  const gpu = seleccion.gpu;
  const ram = seleccion.ram;
  const psu = seleccion.psu;
  const cooler = seleccion.cooler;
  const storage = seleccion.storage;

  const { consumoTotalWatts, fuenteRecomendadaWatts } = calcularConsumoEnsamble(seleccion);
  let score = 95;
  let cuelloBotella = 4;

  const cpuTier = cpu ? estimarTierCPU(cpu) : 0;
  const gpuTier = gpu ? estimarTierGPU(gpu) : 0;

  // 1. Balance CPU vs GPU
  if (cpu && gpu) {
    const diff = gpuTier - cpuTier;
    if (diff > 1.8) {
      cuelloBotella = Math.min(42, Math.round(diff * 8.5));
      score -= Math.min(24, Math.round(diff * 5.5));
      advertencias.push(
        `Cuello de botella CPU (~${cuelloBotella}%): ${cpu.nombre} puede limitar a ${gpu.nombre} en escenarios competitivos 1080p.`
      );
      const mejorCpu = disponibles
        .filter(
          (p) =>
            detectarSlotProducto(p) === 'cpu' &&
            p.id !== cpu.id &&
            evaluarCompatibilidadPieza('cpu', p, seleccion).compatible
        )
        .sort((a, b) => estimarTierCPU(b) - estimarTierCPU(a))
        .find((c) => estimarTierCPU(c) > cpuTier);

      if (mejorCpu) {
        upgrades.push({
          slot: 'cpu',
          producto_actual_id: cpu.id,
          producto_sugerido_id: mejorCpu.id,
          producto_sugerido_nombre: mejorCpu.nombre,
          precio_cop: precioConDescuento(mejorCpu),
          razon_tecnica: 'Reduce el cuello de botella manteniendo el socket y memorias compatibles.',
          ganancia_estimada: `+${Math.max(12, cuelloBotella - 4)}% estabilidad en 1% Low FPS`,
        });
      }
    } else if (diff < -1.8) {
      cuelloBotella = Math.min(35, Math.round(Math.abs(diff) * 7.5));
      score -= Math.min(18, Math.round(Math.abs(diff) * 4));
      advertencias.push(
        `Margen gráfico conservador (~${cuelloBotella}% desbalance): ${cpu.nombre} admite una GPU de mayor jerarquía.`
      );
      const mejorGpu = disponibles
        .filter((p) => detectarSlotProducto(p) === 'gpu' && p.id !== gpu.id)
        .sort((a, b) => estimarTierGPU(b) - estimarTierGPU(a))
        .find((g) => estimarTierGPU(g) > gpuTier);

      if (mejorGpu) {
        upgrades.push({
          slot: 'gpu',
          producto_actual_id: gpu.id,
          producto_sugerido_id: mejorGpu.id,
          producto_sugerido_nombre: mejorGpu.nombre,
          precio_cop: precioConDescuento(mejorGpu),
          razon_tecnica: `Libera todo el cómputo de ${cpu.nombre} con mayor ancho de banda VRAM.`,
          ganancia_estimada: '+28% FPS en 1440p',
        });
      }
    } else {
      cuelloBotella = Math.max(3, Math.round(Math.abs(diff) * 5));
    }
  } else if (cpu && !gpu) {
    score -= 16;
    cuelloBotella = 32;
    advertencias.push('No hay GPU dedicada seleccionada; recomendado añadir tarjeta gráfica para gaming o renderizado.');
    const gpuOptima = disponibles
      .filter((p) => detectarSlotProducto(p) === 'gpu')
      .sort((a, b) => Math.abs(estimarTierGPU(a) - cpuTier) - Math.abs(estimarTierGPU(b) - cpuTier))[0];
    if (gpuOptima) {
      upgrades.push({
        slot: 'gpu',
        producto_actual_id: null,
        producto_sugerido_id: gpuOptima.id,
        producto_sugerido_nombre: gpuOptima.nombre,
        precio_cop: precioConDescuento(gpuOptima),
        razon_tecnica: `Gráfica balanceada sin cuello de botella para tu ${cpu.nombre}.`,
        ganancia_estimada: 'Desbloquea gaming 1080p/1440p + Ray Tracing',
      });
    }
  } else if (!cpu) {
    score -= 28;
    advertencias.push('Selecciona primero un Procesador (CPU) en stock para completar el balance energético.');
    const cpuDisp = disponibles.find((p) => detectarSlotProducto(p) === 'cpu');
    if (cpuDisp) {
      upgrades.push({
        slot: 'cpu',
        producto_actual_id: null,
        producto_sugerido_id: cpuDisp.id,
        producto_sugerido_nombre: cpuDisp.nombre,
        precio_cop: precioConDescuento(cpuDisp),
        razon_tecnica: 'Procesador disponible en inventario listo para iniciar tu arquitectura.',
        ganancia_estimada: 'Base sólida del ensamble',
      });
    }
  }

  // 2. Balance Energético PSU
  if (psu) {
    const psuWatts = extraerSpecsHardware(psu).psuWatts ?? 550;
    if (psuWatts < consumoTotalWatts + 40) {
      score -= 25;
      advertencias.push(
        `Riesgo energético crítico: ${psu.nombre} (${psuWatts}W) es insuficiente frente a ${consumoTotalWatts}W + picos.`
      );
      const psuOptima = disponibles
        .filter((p) => detectarSlotProducto(p) === 'psu' && p.id !== psu.id)
        .find((p) => (extraerSpecsHardware(p).psuWatts ?? 0) >= fuenteRecomendadaWatts);
      if (psuOptima && upgrades.length < 2) {
        upgrades.push({
          slot: 'psu',
          producto_actual_id: psu.id,
          producto_sugerido_id: psuOptima.id,
          producto_sugerido_nombre: psuOptima.nombre,
          precio_cop: precioConDescuento(psuOptima),
          razon_tecnica: `Asegura margen mínimo de ${fuenteRecomendadaWatts}W para estabilidad bajo carga.`,
          ganancia_estimada: 'Estabilidad eléctrica 100%',
        });
      }
    } else if (psuWatts < fuenteRecomendadaWatts) {
      score -= 8;
      advertencias.push(
        `Margen térmico/PSU ajustado (${psuWatts}W vs ${fuenteRecomendadaWatts}W recomendados con holgura del 25%).`
      );
    }
  } else if (consumoTotalWatts > 0) {
    score -= 10;
    advertencias.push(`Falta Fuente de Poder (PSU): se recomiendan ${fuenteRecomendadaWatts}W o superior.`);
    const psuDisp =
      disponibles
        .filter((p) => detectarSlotProducto(p) === 'psu')
        .find((p) => (extraerSpecsHardware(p).psuWatts ?? 0) >= fuenteRecomendadaWatts) ??
      disponibles.find((p) => detectarSlotProducto(p) === 'psu');
    if (psuDisp && upgrades.length < 2) {
      upgrades.push({
        slot: 'psu',
        producto_actual_id: null,
        producto_sugerido_id: psuDisp.id,
        producto_sugerido_nombre: psuDisp.nombre,
        precio_cop: precioConDescuento(psuDisp),
        razon_tecnica: `Suministro calibrado para tu demanda de ${consumoTotalWatts}W.`,
        ganancia_estimada: 'Protección contra picos',
      });
    }
  }

  // 3. Disipación Térmica CPU
  const cpuTdp = cpu ? extraerSpecsHardware(cpu).tdpWatts : 0;
  if (cpu && cpuTdp >= 95 && !cooler) {
    score -= 10;
    advertencias.push(
      `Alerta térmica: ${cpu.nombre} (${cpuTdp}W TDP) requiere disipador dedicado para sostener frecuencias Boost.`
    );
    const coolerCompat = disponibles.find(
      (p) => detectarSlotProducto(p) === 'cooler' && evaluarCompatibilidadPieza('cooler', p, seleccion).compatible
    );
    if (coolerCompat && upgrades.length < 2) {
      upgrades.push({
        slot: 'cooler',
        producto_actual_id: null,
        producto_sugerido_id: coolerCompat.id,
        producto_sugerido_nombre: coolerCompat.nombre,
        precio_cop: precioConDescuento(coolerCompat),
        razon_tecnica: `Evita thermal throttling en cargas sostenidas de ${cpu.nombre}.`,
        ganancia_estimada: '-18°C temperatura pico',
      });
    }
  }

  // 4. RAM Dual-Channel y Almacenamiento
  if (ram) {
    const capTxt = `${ram.especificaciones?.['Capacidad'] || ''} ${ram.nombre}`.toLowerCase();
    const isSingle8 = capTxt.includes('8gb') && !capTxt.includes('2 x 8') && !capTxt.includes('16gb');
    if (isSingle8) {
      score -= 8;
      advertencias.push('Kit RAM de 8GB ajustado: se recomienda Dual-Channel 16GB+ (2x8GB) para evitar micro-stuttering.');
    }
  } else if (cpu) {
    score -= 12;
    advertencias.push('Memoria RAM pendiente de seleccionar para completar la arquitectura.');
    const ramCompat = disponibles.find(
      (p) => detectarSlotProducto(p) === 'ram' && evaluarCompatibilidadPieza('ram', p, seleccion).compatible
    );
    if (ramCompat && upgrades.length < 2) {
      upgrades.push({
        slot: 'ram',
        producto_actual_id: null,
        producto_sugerido_id: ramCompat.id,
        producto_sugerido_nombre: ramCompat.nombre,
        precio_cop: precioConDescuento(ramCompat),
        razon_tecnica: 'Kit Dual-Channel compatible verificado para maximizar ancho de banda.',
        ganancia_estimada: '+15% fluidez en 1% Low FPS',
      });
    }
  }

  if (!storage && Object.keys(seleccion).length >= 3) {
    score -= 5;
    const ssdDisp = disponibles.find((p) => detectarSlotProducto(p) === 'storage');
    if (ssdDisp && upgrades.length < 2) {
      upgrades.push({
        slot: 'storage',
        producto_actual_id: null,
        producto_sugerido_id: ssdDisp.id,
        producto_sugerido_nombre: ssdDisp.nombre,
        precio_cop: precioConDescuento(ssdDisp),
        razon_tecnica: 'Almacenamiento NVMe de alta velocidad requerido para sistema y carga instantánea.',
        ganancia_estimada: 'Hasta 3,500 MB/s NVMe',
      });
    }
  }

  const finalScore = Math.max(15, Math.min(100, Math.round(score)));
  const avgTier = cpu && gpu ? (cpuTier + gpuTier) / 2 : Math.max(cpuTier, gpuTier);

  let nivel_ensamble: AnalisisEnsambleIA['nivel_ensamble'] = 'Mid-Range Balanced';
  if (avgTier >= 8.2) nivel_ensamble = 'Workstation / Enthusiast';
  else if (avgTier >= 6.4) nivel_ensamble = 'High-End Gaming';
  else if (avgTier < 4.4) nivel_ensamble = 'Entry-Level';

  const diagnostico_tecnico =
    advertencias.length === 0
      ? `Arquitectura óptima y balanceada (${cuelloBotella}% cuello de botella natural). Reserva eléctrica recomendada de ${fuenteRecomendadaWatts}W y cero conflictos de compatibilidad.`
      : finalScore >= 80
        ? `Ensamble sólido (${finalScore}/100) con mínimo margen de mejora. Revisa las observaciones puntuales para optimizar térmicas o entrega de poder.`
        : `Ensamble desbalanceado o incompleto (${finalScore}/100). Aplica los upgrades sugeridos del inventario real para eliminar cuellos de botella.`;

  return {
    puntuacion_balance: finalScore,
    nivel_ensamble,
    diagnostico_tecnico,
    cuello_botella_porcentaje: cuelloBotella,
    advertencias,
    upgrades_sugeridos: upgrades.slice(0, 2),
    fuente_analisis: 'heuristic-engine',
  };
}

interface PCBuilderState {
  seleccion: Partial<Record<PCBuilderSlot, Producto>>;
  pasoActual: PCBuilderSlot;
  soloCompatibles: boolean;
  analisisIA: AnalisisEnsambleIA | null;
  analizandoIA: boolean;
  seleccionarPieza: (slot: PCBuilderSlot, producto: Producto) => void;
  quitarPieza: (slot: PCBuilderSlot) => void;
  setPasoActual: (slot: PCBuilderSlot) => void;
  setSoloCompatibles: (valor: boolean) => void;
  reiniciarBuilder: () => void;
  limpiarAnalisisIA: () => void;
  ejecutarAnalisisIA: (catalogo: Producto[]) => Promise<AnalisisEnsambleIA>;
  aplicarUpgradeIA: (slot: PCBuilderSlot, producto: Producto, catalogo: Producto[]) => void;
}

export const usePCBuilderStore = create<PCBuilderState>()(
  persist(
    (set, get) => ({
      seleccion: {},
      pasoActual: 'cpu',
      soloCompatibles: true,
      analisisIA: null,
      analizandoIA: false,

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
            analisisIA: null,
          };
        }),

      quitarPieza: (slot) =>
        set((state) => {
          const copia = { ...state.seleccion };
          delete copia[slot];
          return { seleccion: copia, analisisIA: null };
        }),

      setPasoActual: (slot) => set({ pasoActual: slot }),
      setSoloCompatibles: (valor) => set({ soloCompatibles: valor }),
      reiniciarBuilder: () => set({ seleccion: {}, pasoActual: 'cpu', analisisIA: null }),
      limpiarAnalisisIA: () => set({ analisisIA: null }),

      ejecutarAnalisisIA: async (catalogo) => {
        const seleccionActual = get().seleccion;
        set({ analizandoIA: true });

        try {
          const catalogoDisponible = catalogo.filter((p) => (p.stock ?? 0) > 0);
          const edgePromise = supabase.functions.invoke<AnalisisEnsambleIA>('analizar-ensamble', {
            body: {
              ensamble: seleccionActual,
              catalogo_disponible: catalogoDisponible,
            },
          });
          const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 3800)
          );

          const { data, error } = await Promise.race([edgePromise, timeoutPromise]);

          if (!error && data && typeof data.puntuacion_balance === 'number') {
            set({ analisisIA: data, analizandoIA: false });
            return data;
          }
        } catch {
          // Fallback silencioso al motor heurístico determinístico
        }

        const resultadoLocal = analizarEnsambleDeterministico(seleccionActual, catalogo);
        set({ analisisIA: resultadoLocal, analizandoIA: false });
        return resultadoLocal;
      },

      aplicarUpgradeIA: (slot, producto, catalogo) => {
        const nuevaSeleccion = { ...get().seleccion, [slot]: producto };
        const nuevoAnalisis = analizarEnsambleDeterministico(nuevaSeleccion, catalogo);
        set({
          seleccion: nuevaSeleccion,
          pasoActual: slot,
          analisisIA: nuevoAnalisis,
        });
      },
    }),
    {
      name: 'nexus_pc_builder_v1',
      partialize: (state) => ({
        seleccion: state.seleccion,
        pasoActual: state.pasoActual,
        soloCompatibles: state.soloCompatibles,
      }),
    }
  )
);

