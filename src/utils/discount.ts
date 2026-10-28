export type DiscountTier = 'none' | 'low' | 'medium' | 'high';

export interface DiscountBadgeStyle {
  tier: DiscountTier;
  /** Porcentaje redondeado a entero y acotado a [0, 100]. */
  percentage: number;
  /** Clases Tailwind del badge (gradiente, brillo, borde, sombra, animación). */
  className: string;
  /** Icono dinámico atractivo según el nivel de oferta (✨, ⚡, 🔥). */
  icon: string;
  /** Etiqueta complementaria para destacar el nivel de oferta. */
  label: string;
  /** Compatibilidad con flag de fuego para ofertas agresivas. */
  showFire: boolean;
}

const STYLES: Record<Exclude<DiscountTier, 'none'>, string> = {
  // 1% – 15% (Oferta Inicial Tentadora): Gradiente Esmeralda / Teal vibrante con brillo sutil
  low: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white border border-emerald-300/40 font-black shadow-md shadow-emerald-500/30 backdrop-blur-md',
  // 16% – 35% (Súper Oferta): Gradiente Ámbar / Naranja / Rosa encendido con animación suave y glow cálido
  medium:
    'bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 bg-[length:200%_auto] animate-gradient text-white border border-amber-200/50 font-black shadow-lg shadow-orange-500/40 ring-1 ring-amber-400/40 backdrop-blur-md',
  // > 35% (Oferta Extrema / Liquidación): Gradiente Rojo / Fucsia / Violeta de máximo impacto con doble halo y animación intensa
  high: 'bg-gradient-to-r from-red-600 via-rose-500 to-fuchsia-600 bg-[length:200%_auto] animate-gradient text-white border border-white/40 font-black shadow-[0_0_20px_rgba(244,63,94,0.6)] ring-2 ring-rose-400/60 backdrop-blur-md scale-[1.03]',
};

/**
 * Devuelve el estilo progresivo del badge de descuento según el rango del porcentaje.
 * 1-15 → low (Esmeralda/Cyan ✨) · 16-35 → medium (Ámbar/Naranja ⚡) · >35 → high (Rojo/Fucsia 🔥) · ≤0 → none
 */
export function getDiscountBadgeStyle(percentage: number | null | undefined): DiscountBadgeStyle {
  const pct = Math.min(Math.max(Math.round(Number(percentage) || 0), 0), 100);

  if (pct <= 0) {
    return { tier: 'none', percentage: 0, className: '', icon: '', label: '', showFire: false };
  }
  if (pct <= 15) {
    return {
      tier: 'low',
      percentage: pct,
      className: STYLES.low,
      icon: '✨',
      label: 'OFERTA',
      showFire: false,
    };
  }
  if (pct <= 35) {
    return {
      tier: 'medium',
      percentage: pct,
      className: STYLES.medium,
      icon: '⚡',
      label: 'SÚPER OFERTA',
      showFire: false,
    };
  }
  return {
    tier: 'high',
    percentage: pct,
    className: STYLES.high,
    icon: '🔥',
    label: 'PRECIO BOMBA',
    showFire: true,
  };
}
