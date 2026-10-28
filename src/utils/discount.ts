export type DiscountTier = 'none' | 'low' | 'medium' | 'high';

export interface DiscountBadgeStyle {
  tier: DiscountTier;
  /** Porcentaje redondeado a entero y acotado a [0, 100]. */
  percentage: number;
  /** Clases Tailwind del badge (color, borde, sombra, animación). */
  className: string;
  /** Muestra el icono 🔥 solo en ofertas agresivas. */
  showFire: boolean;
}

const STYLES: Record<Exclude<DiscountTier, 'none'>, string> = {
  // 1% – 15%: neutro / discreto
  low: 'bg-themeCard/90 text-themeTextMuted border border-themeBorder font-bold backdrop-blur-sm',
  // 16% – 35%: alerta intermedia
  medium: 'bg-amber-500/90 text-white border border-amber-300/50 font-black shadow-md shadow-amber-500/25',
  // > 35%: alto impacto
  high: 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600 bg-[length:200%_auto] animate-gradient text-white border border-white/25 font-black shadow-lg shadow-red-500/40 ring-2 ring-red-500/30',
};

/**
 * Devuelve el estilo del badge de descuento según el rango del porcentaje.
 * 1-15 → low · 16-35 → medium · >35 → high · ≤0 → none
 */
export function getDiscountBadgeStyle(percentage: number | null | undefined): DiscountBadgeStyle {
  const pct = Math.min(Math.max(Math.round(Number(percentage) || 0), 0), 100);

  if (pct <= 0) return { tier: 'none', percentage: 0, className: '', showFire: false };
  if (pct <= 15) return { tier: 'low', percentage: pct, className: STYLES.low, showFire: false };
  if (pct <= 35) return { tier: 'medium', percentage: pct, className: STYLES.medium, showFire: false };
  return { tier: 'high', percentage: pct, className: STYLES.high, showFire: true };
}
