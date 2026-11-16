// Supabase Edge Function: analizar-ensamble
// Asesor inteligente de arquitectura de hardware y detección de cuellos de botella.
// Soporta Structured Outputs vía LLM (Gemini / OpenAI) con verificación contra stock real
// y fallback heurístico determinístico de baja latencia (<50 ms) si no hay API Key.

type PCBuilderSlot = 'cpu' | 'board' | 'ram' | 'gpu' | 'storage' | 'case' | 'cooler' | 'psu';

interface ProductoInput {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  stock: number;
  descuento?: number;
  marca?: string;
  especificaciones?: Record<string, string>;
}

interface UpgradeSugerido {
  slot: PCBuilderSlot;
  producto_actual_id?: number | null;
  producto_sugerido_id: number;
  producto_sugerido_nombre: string;
  precio_cop: number;
  razon_tecnica: string;
  ganancia_estimada: string;
}

interface AnalisisEnsambleResponse {
  puntuacion_balance: number;
  nivel_ensamble: 'Entry-Level' | 'Mid-Range Balanced' | 'High-End Gaming' | 'Workstation / Enthusiast';
  diagnostico_tecnico: string;
  cuello_botella_porcentaje: number;
  advertencias: string[];
  upgrades_sugeridos: UpgradeSugerido[];
  fuente_analisis: 'ai-llm' | 'heuristic-engine';
}

interface RequestPayload {
  ensamble: Partial<Record<PCBuilderSlot, ProductoInput>>;
  catalogo_disponible?: ProductoInput[];
}

interface DenoGlobal {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function precioFinal(p: ProductoInput): number {
  const desc = p.descuento ?? 0;
  return desc > 0 ? Math.round(p.precio * (1 - desc / 100)) : p.precio;
}

function detectarSlot(p: ProductoInput): PCBuilderSlot | null {
  const specs = p.especificaciones ?? {};
  const nombre = (p.nombre || '').toLowerCase();
  const cat = (p.categoria || '').toLowerCase();

  if (
    cat.includes('madre') ||
    cat.includes('board') ||
    nombre.includes('tarjeta madre') ||
    nombre.includes('motherboard') ||
    Boolean(specs['Chipset'])
  ) {
    return 'board';
  }
  if (
    cat.includes('cooler') ||
    cat.includes('refriger') ||
    nombre.includes('cooler') ||
    nombre.includes('disipador') ||
    nombre.includes('noctua')
  ) {
    return 'cooler';
  }
  if (cat.includes('ram') || nombre.includes('ram') || nombre.includes('ddr4') || nombre.includes('ddr5')) {
    return 'ram';
  }
  if (cat.includes('gpu') || cat.includes('gráfica') || cat.includes('grafica') || nombre.includes('rtx') || nombre.includes('radeon')) {
    return 'gpu';
  }
  if (cat.includes('ssd') || cat.includes('almacenamiento') || nombre.includes('nvme') || nombre.includes('ssd')) {
    return 'storage';
  }
  if (cat.includes('fuente') || cat.includes('psu') || nombre.includes('fuente') || nombre.includes('80 plus')) {
    return 'psu';
  }
  if (cat.includes('gabinete') || cat.includes('chasis') || nombre.includes('gabinete') || nombre.includes('chasis')) {
    return 'case';
  }
  if (cat.includes('procesador') || cat.includes('cpu') || nombre.includes('ryzen') || nombre.includes('core i')) {
    return 'cpu';
  }
  return null;
}

function parseWatts(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{2,4})\s*w/i) || raw.match(/^(\d{2,4})$/);
  return match ? parseInt(match[1], 10) : null;
}

function extraerSocketYRam(p: ProductoInput): { socket: string | null; ramType: 'DDR4' | 'DDR5' | null } {
  const specs = p.especificaciones ?? {};
  const txt = `${p.nombre} ${Object.entries(specs).map(([k, v]) => `${k}:${v}`).join(' ')}`.toUpperCase();
  let socket: string | null = (specs['Zócalo'] || specs['Socket'] || '').toUpperCase().trim() || null;
  if (!socket) {
    if (txt.includes('AM5')) socket = 'AM5';
    else if (txt.includes('AM4')) socket = 'AM4';
    else if (txt.includes('LGA1700') || txt.includes('LGA 1700')) socket = 'LGA1700';
    else if (txt.includes('LGA1200') || txt.includes('LGA 1200')) socket = 'LGA1200';
  }

  let ramType: 'DDR4' | 'DDR5' | null = null;
  if (txt.includes('DDR5')) ramType = 'DDR5';
  else if (txt.includes('DDR4')) ramType = 'DDR4';
  else if (socket === 'AM5') ramType = 'DDR5';
  else if (socket === 'AM4') ramType = 'DDR4';

  return { socket, ramType };
}

function estimarTierCPU(cpu: ProductoInput): number {
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

function estimarTierGPU(gpu: ProductoInput): number {
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

function esCandidatoCompatible(
  slot: PCBuilderSlot,
  cand: ProductoInput,
  ensamble: Partial<Record<PCBuilderSlot, ProductoInput>>
): boolean {
  const candMeta = extraerSocketYRam(cand);
  const cpuMeta = ensamble.cpu ? extraerSocketYRam(ensamble.cpu) : null;
  const boardMeta = ensamble.board ? extraerSocketYRam(ensamble.board) : null;

  if (slot === 'cpu' && boardMeta?.socket && candMeta.socket && boardMeta.socket !== candMeta.socket) {
    return false;
  }
  if (slot === 'board' && cpuMeta?.socket && candMeta.socket && cpuMeta.socket !== candMeta.socket) {
    return false;
  }
  if (slot === 'ram') {
    const reqRam = boardMeta?.ramType ?? cpuMeta?.ramType;
    if (reqRam && candMeta.ramType && reqRam !== candMeta.ramType) return false;
  }
  return true;
}

function analizarConHeuristica(
  ensamble: Partial<Record<PCBuilderSlot, ProductoInput>>,
  catalogo: ProductoInput[]
): AnalisisEnsambleResponse {
  const disponibles = catalogo.filter((p) => (p.stock ?? 0) > 0);
  const advertencias: string[] = [];
  const upgrades: UpgradeSugerido[] = [];

  const cpu = ensamble.cpu;
  const gpu = ensamble.gpu;
  const ram = ensamble.ram;
  const psu = ensamble.psu;
  const cooler = ensamble.cooler;
  const storage = ensamble.storage;

  let score = 94;
  let cuelloBotella = 4;

  // Consumo estimado total
  const defaultWatts: Record<PCBuilderSlot, number> = {
    cpu: 85,
    board: 35,
    ram: 10,
    gpu: 160,
    storage: 8,
    cooler: 10,
    case: 10,
    psu: 0,
  };
  let consumoTotal = 0;
  (Object.entries(ensamble) as [PCBuilderSlot, ProductoInput | undefined][]).forEach(([slot, prod]) => {
    if (!prod || slot === 'psu') return;
    const specs = prod.especificaciones ?? {};
    const w = parseWatts(specs['TDP']) ?? parseWatts(specs['Consumo']) ?? defaultWatts[slot];
    consumoTotal += w;
  });
  const fuenteRecomendada = Math.max(450, Math.ceil(((consumoTotal + 40) * 1.25) / 50) * 50);

  const cpuTier = cpu ? estimarTierCPU(cpu) : 0;
  const gpuTier = gpu ? estimarTierGPU(gpu) : 0;

  // 1. Balance CPU vs GPU
  if (cpu && gpu) {
    const diff = gpuTier - cpuTier;
    if (diff > 1.8) {
      cuelloBotella = Math.min(42, Math.round(diff * 8.5));
      score -= Math.min(24, Math.round(diff * 5.5));
      advertencias.push(
        `Cuello de botella de procesador (~${cuelloBotella}%): ${cpu.nombre} puede limitar a ${gpu.nombre} en juegos competitivos a 1080p.`
      );
      const mejorCpu = disponibles
        .filter((p) => detectarSlot(p) === 'cpu' && p.id !== cpu.id && esCandidatoCompatible('cpu', p, ensamble))
        .sort((a, b) => estimarTierCPU(b) - estimarTierCPU(a))
        .find((c) => estimarTierCPU(c) > cpuTier);

      if (mejorCpu) {
        upgrades.push({
          slot: 'cpu',
          producto_actual_id: cpu.id,
          producto_sugerido_id: mejorCpu.id,
          producto_sugerido_nombre: mejorCpu.nombre,
          precio_cop: precioFinal(mejorCpu),
          razon_tecnica: 'Elimina el cuello de botella del procesador manteniendo compatibilidad con tu plataforma.',
          ganancia_estimada: `+${Math.max(12, cuelloBotella - 4)}% estabilidad en 1% Low FPS`,
        });
      }
    } else if (diff < -1.8) {
      cuelloBotella = Math.min(35, Math.round(Math.abs(diff) * 7.5));
      score -= Math.min(18, Math.round(Math.abs(diff) * 4));
      advertencias.push(
        `Capacidad gráfica conservadora (~${cuelloBotella}% de margen GPU): ${cpu.nombre} tiene potencia de cómputo para impulsar una GPU superior.`
      );
      const mejorGpu = disponibles
        .filter((p) => detectarSlot(p) === 'gpu' && p.id !== gpu.id)
        .sort((a, b) => estimarTierGPU(b) - estimarTierGPU(a))
        .find((g) => estimarTierGPU(g) > gpuTier);

      if (mejorGpu) {
        upgrades.push({
          slot: 'gpu',
          producto_actual_id: gpu.id,
          producto_sugerido_id: mejorGpu.id,
          producto_sugerido_nombre: mejorGpu.nombre,
          precio_cop: precioFinal(mejorGpu),
          razon_tecnica: `Aprovecha el potencial multi-hilo de ${cpu.nombre} con mayor VRAM y rendimiento gráfico.`,
          ganancia_estimada: '+28% FPS promedio en 1440p',
        });
      }
    } else {
      cuelloBotella = Math.max(3, Math.round(Math.abs(diff) * 5));
    }
  } else if (cpu && !gpu) {
    score -= 18;
    cuelloBotella = 35;
    advertencias.push(
      'Ensamble sin GPU dedicada: rendimiento limitado a gráficos integrados (si aplica) o tareas ofimáticas.'
    );
    const gpuRecomendada = disponibles
      .filter((p) => detectarSlot(p) === 'gpu')
      .sort((a, b) => Math.abs(estimarTierGPU(a) - cpuTier) - Math.abs(estimarTierGPU(b) - cpuTier))[0];

    if (gpuRecomendada) {
      upgrades.push({
        slot: 'gpu',
        producto_actual_id: null,
        producto_sugerido_id: gpuRecomendada.id,
        producto_sugerido_nombre: gpuRecomendada.nombre,
        precio_cop: precioFinal(gpuRecomendada),
        razon_tecnica: `Emparejamiento óptimo sin cuello de botella para acompañar a ${cpu.nombre}.`,
        ganancia_estimada: 'Desbloquea gaming 1080p/1440p y aceleración GPU',
      });
    }
  } else if (!cpu) {
    score -= 30;
    advertencias.push('Falta seleccionar el Procesador (CPU) base para completar el diagnóstico del sistema.');
  }

  // 2. Margen energético (PSU)
  if (psu) {
    const psuWatts = parseWatts(psu.especificaciones?.['Potencia']) ?? parseWatts(psu.nombre) ?? 550;
    if (psuWatts < consumoTotal + 40) {
      score -= 26;
      advertencias.push(
        `Riesgo energético crítico: La fuente ${psu.nombre} (${psuWatts}W) queda por debajo del consumo estimado (${consumoTotal}W + margen transitorio).`
      );
      const psuMayor = disponibles
        .filter((p) => detectarSlot(p) === 'psu' && p.id !== psu.id)
        .find((p) => (parseWatts(p.especificaciones?.['Potencia']) ?? parseWatts(p.nombre) ?? 0) >= fuenteRecomendada);
      if (psuMayor && upgrades.length < 2) {
        upgrades.push({
          slot: 'psu',
          producto_actual_id: psu.id,
          producto_sugerido_id: psuMayor.id,
          producto_sugerido_nombre: psuMayor.nombre,
          precio_cop: precioFinal(psuMayor),
          razon_tecnica: `Asegura estabilidad eléctrica con reserva mínima recomendada de ${fuenteRecomendada}W.`,
          ganancia_estimada: 'Cero apagones bajo carga pico',
        });
      }
    } else if (psuWatts < fuenteRecomendada) {
      score -= 8;
      advertencias.push(
        `Margen de potencia ajustado: ${psuWatts}W opera cerca del umbral óptimo (${fuenteRecomendada}W recomendados para eficiencia 80+).`
      );
    }
  } else if (consumoTotal > 0) {
    score -= 10;
    advertencias.push(`No has elegido Fuente de Poder (PSU). Se recomienda mínimo ${fuenteRecomendada}W.`);
    const psuSugerida = disponibles
      .filter((p) => detectarSlot(p) === 'psu')
      .find((p) => (parseWatts(p.especificaciones?.['Potencia']) ?? parseWatts(p.nombre) ?? 0) >= fuenteRecomendada)
      ?? disponibles.find((p) => detectarSlot(p) === 'psu');
    if (psuSugerida && upgrades.length < 2) {
      upgrades.push({
        slot: 'psu',
        producto_actual_id: null,
        producto_sugerido_id: psuSugerida.id,
        producto_sugerido_nombre: psuSugerida.nombre,
        precio_cop: precioFinal(psuSugerida),
        razon_tecnica: `Suministro estable calibrado para tu demanda estimada de ${consumoTotal}W.`,
        ganancia_estimada: 'Protección OCP/OVP activa',
      });
    }
  }

  // 3. Refrigeración CPU para chips de alto TDP (>= 95W)
  const cpuTdp = cpu ? (parseWatts(cpu.especificaciones?.['TDP']) ?? 85) : 0;
  if (cpu && cpuTdp >= 95 && !cooler) {
    score -= 10;
    advertencias.push(
      `Riesgo térmico: ${cpu.nombre} (${cpuTdp}W TDP) requiere disipación dedicada para sostener frecuencias turbo sin thermal throttling.`
    );
    const coolerCompat = disponibles.find(
      (p) => detectarSlot(p) === 'cooler' && esCandidatoCompatible('cooler', p, ensamble)
    );
    if (coolerCompat && upgrades.length < 2) {
      upgrades.push({
        slot: 'cooler',
        producto_actual_id: null,
        producto_sugerido_id: coolerCompat.id,
        producto_sugerido_nombre: coolerCompat.nombre,
        precio_cop: precioFinal(coolerCompat),
        razon_tecnica: `Mantiene temperaturas bajo control para sostener el boost máximo de ${cpu.nombre}.`,
        ganancia_estimada: '-18°C en carga sostenida',
      });
    }
  }

  // 4. Memoria RAM y Almacenamiento
  if (ram) {
    const cap = (ram.especificaciones?.['Capacidad'] || ram.nombre).toLowerCase();
    if (cap.includes('8gb') && !cap.includes('2 x 8') && !cap.includes('16gb')) {
      score -= 8;
      advertencias.push('Memoria de 8GB ajustada para multitarea/gaming moderno; se recomiendan 16GB+ en Dual-Channel.');
    }
  } else if (cpu) {
    score -= 12;
    advertencias.push('Falta asignar memoria RAM compatible para completar la ruta crítica de datos.');
  }

  if (!storage && Object.keys(ensamble).length >= 3) {
    score -= 6;
    advertencias.push('Sin almacenamiento NVMe asignado: imprescindible para tiempos de carga y sistema operativo.');
    const ssdDisp = disponibles.find((p) => detectarSlot(p) === 'storage');
    if (ssdDisp && upgrades.length < 2) {
      upgrades.push({
        slot: 'storage',
        producto_actual_id: null,
        producto_sugerido_id: ssdDisp.id,
        producto_sugerido_nombre: ssdDisp.nombre,
        precio_cop: precioFinal(ssdDisp),
        razon_tecnica: 'Elimina latencias de disco en arranque, streaming de texturas y compilaciones.',
        ganancia_estimada: 'Hasta 3,500 MB/s NVMe',
      });
    }
  }

  // Completar hasta 2 sugerencias útiles si hay mejoras claras en catálogo con stock > 0
  if (upgrades.length === 0 && gpu) {
    const mejorGpu = disponibles
      .filter((p) => detectarSlot(p) === 'gpu' && p.id !== gpu.id && precioFinal(p) > precioFinal(gpu))
      .sort((a, b) => precioFinal(a) - precioFinal(b))[0];
    if (mejorGpu) {
      upgrades.push({
        slot: 'gpu',
        producto_actual_id: gpu.id,
        producto_sugerido_id: mejorGpu.id,
        producto_sugerido_nombre: mejorGpu.nombre,
        precio_cop: precioFinal(mejorGpu),
        razon_tecnica: 'Siguiente salto gráfico en inventario para mayor tasa de cuadros y Ray Tracing.',
        ganancia_estimada: '+22% rendimiento gráfico',
      });
    }
  }

  const finalScore = Math.max(15, Math.min(100, Math.round(score)));
  const avgTier = cpu && gpu ? (cpuTier + gpuTier) / 2 : Math.max(cpuTier, gpuTier);

  let nivel: AnalisisEnsambleResponse['nivel_ensamble'] = 'Mid-Range Balanced';
  if (avgTier >= 8.2) nivel = 'Workstation / Enthusiast';
  else if (avgTier >= 6.4) nivel = 'High-End Gaming';
  else if (avgTier < 4.4) nivel = 'Entry-Level';

  const diagnostico =
    advertencias.length === 0
      ? `Arquitectura altamente equilibrada (${cuelloBotella}% cuello de botella natural). Excelente sintonía térmica y energética con margen recomendado de ${fuenteRecomendada}W.`
      : finalScore >= 80
        ? `Ensamble sólido con balance ${100 - cuelloBotella}% aprovechable. Revisa las observaciones menores para exprimir el último tramo de estabilidad.`
        : `Se detectaron asimetrías o faltantes clave que afectan el rendimiento sostenido. Aplica las sugerencias conectadas al inventario en vivo para equilibrar la plataforma.`;

  return {
    puntuacion_balance: finalScore,
    nivel_ensamble: nivel,
    diagnostico_tecnico: diagnostico,
    cuello_botella_porcentaje: cuelloBotella,
    advertencias,
    upgrades_sugeridos: upgrades.slice(0, 2),
    fuente_analisis: 'heuristic-engine',
  };
}

async function intentarAnalisisLLM(
  apiKey: string,
  provider: 'gemini' | 'openai',
  ensamble: Partial<Record<PCBuilderSlot, ProductoInput>>,
  catalogo: ProductoInput[],
  fallback: AnalisisEnsambleResponse
): Promise<AnalisisEnsambleResponse | null> {
  const disponiblesMap = new Map<number, ProductoInput>();
  const disponiblesResumen = catalogo
    .filter((p) => (p.stock ?? 0) > 0)
    .map((p) => {
      disponiblesMap.set(p.id, p);
      return {
        id: p.id,
        slot: detectarSlot(p),
        nombre: p.nombre,
        precio_cop: precioFinal(p),
        stock: p.stock,
        specs: p.especificaciones ?? {},
      };
    });

  const prompt = `Eres un Staff Hardware Architect de NEXUS // CORE. Analiza el siguiente ensamble de PC y devuelve ÚNICAMENTE un JSON válido (sin markdown) con esta estructura exacta:
{
  "puntuacion_balance": number (0 a 100),
  "nivel_ensamble": "Entry-Level" | "Mid-Range Balanced" | "High-End Gaming" | "Workstation / Enthusiast",
  "diagnostico_tecnico": string (máximo 220 caracteres, técnico y directo en español),
  "cuello_botella_porcentaje": number (0 a 50),
  "advertencias": string[] (máximo 3 alertas concretas sobre cuello de botella CPU/GPU, PSU o enfriamiento),
  "upgrades_sugeridos": [
    {
      "slot": "cpu" | "board" | "ram" | "gpu" | "storage" | "case" | "cooler" | "psu",
      "producto_actual_id": number | null,
      "producto_sugerido_id": number (DEBE existir en catalogo_disponible),
      "razon_tecnica": string (máximo 130 caracteres),
      "ganancia_estimada": string (ej. "+18% FPS en 1440p" o "-15°C")
    }
  ] (máximo 2 upgrades)
}

ENSAMBLE ACTUAL:
${JSON.stringify(ensamble)}

CATALOGO DISPONIBLE (stock > 0):
${JSON.stringify(disponiblesResumen)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    let rawJsonText = '';

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Responde estrictamente en formato JSON válido.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      rawJsonText = data.choices?.[0]?.message?.content ?? '';
    }

    if (!rawJsonText) return null;

    const parsed = JSON.parse(rawJsonText) as Partial<AnalisisEnsambleResponse>;
    const upgradesValidados: UpgradeSugerido[] = [];

    if (Array.isArray(parsed.upgrades_sugeridos)) {
      for (const up of parsed.upgrades_sugeridos) {
        const prodReal = disponiblesMap.get(Number(up.producto_sugerido_id));
        if (!prodReal || prodReal.stock <= 0) continue;
        const slotReal = detectarSlot(prodReal) ?? up.slot;
        if (!esCandidatoCompatible(slotReal, prodReal, ensamble)) continue;

        upgradesValidados.push({
          slot: slotReal,
          producto_actual_id: ensamble[slotReal]?.id ?? up.producto_actual_id ?? null,
          producto_sugerido_id: prodReal.id,
          producto_sugerido_nombre: prodReal.nombre,
          precio_cop: precioFinal(prodReal),
          razon_tecnica: String(up.razon_tecnica || 'Mejora recomendada de catálogo real.'),
          ganancia_estimada: String(up.ganancia_estimada || 'Mayor balance'),
        });
        if (upgradesValidados.length >= 2) break;
      }
    }

    return {
      puntuacion_balance: Math.max(0, Math.min(100, Number(parsed.puntuacion_balance ?? fallback.puntuacion_balance))),
      nivel_ensamble: parsed.nivel_ensamble ?? fallback.nivel_ensamble,
      diagnostico_tecnico: String(parsed.diagnostico_tecnico || fallback.diagnostico_tecnico),
      cuello_botella_porcentaje: Math.max(
        0,
        Math.min(50, Number(parsed.cuello_botella_porcentaje ?? fallback.cuello_botella_porcentaje))
      ),
      advertencias: Array.isArray(parsed.advertencias)
        ? parsed.advertencias.slice(0, 3).map(String)
        : fallback.advertencias,
      upgrades_sugeridos: upgradesValidados.length > 0 ? upgradesValidados : fallback.upgrades_sugeridos,
      fuente_analisis: 'ai-llm',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const denoRuntime = (globalThis as unknown as { Deno?: DenoGlobal }).Deno;

if (denoRuntime) {
  denoRuntime.serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = (await req.json()) as RequestPayload;
      const ensamble = body.ensamble ?? {};
      let catalogo = Array.isArray(body.catalogo_disponible) ? body.catalogo_disponible : [];

      // Si no se envió catálogo y hay credenciales de servicio, consultar stock real en PostgreSQL
      const supabaseUrl = denoRuntime.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = denoRuntime.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (catalogo.length === 0 && supabaseUrl && serviceRoleKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/productos?stock=gt.0&select=id,nombre,precio,categoria,stock,descuento,marca,especificaciones`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );
        if (res.ok) {
          catalogo = (await res.json()) as ProductoInput[];
        }
      }

      const fallbackResult = analizarConHeuristica(ensamble, catalogo);

      const geminiKey = denoRuntime.env.get('GEMINI_API_KEY');
      const openaiKey = denoRuntime.env.get('OPENAI_API_KEY');

      let finalResult: AnalisisEnsambleResponse | null = null;
      if (geminiKey) {
        finalResult = await intentarAnalisisLLM(geminiKey, 'gemini', ensamble, catalogo, fallbackResult);
      } else if (openaiKey) {
        finalResult = await intentarAnalisisLLM(openaiKey, 'openai', ensamble, catalogo, fallbackResult);
      }

      return new Response(JSON.stringify(finalResult ?? fallbackResult), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno analizando ensamble' }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  });
}

