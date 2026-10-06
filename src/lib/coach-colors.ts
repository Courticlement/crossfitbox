// Curated palette for Coach.color — deliberately excludes red, emerald/green,
// and amber/yellow, since those already carry meaning elsewhere on the
// Planning grid (MISSED, DONE, unassigned/warning respectively). Picking one
// of these for a coach would visually collide with those status signals.
export const COACH_COLORS = [
  { name: "Bleu", value: "#3b82f6" },
  { name: "Azur", value: "#0ea5e9" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Turquoise", value: "#14b8a6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pourpre", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Rose", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Marine", value: "#1d4ed8" },
  { name: "Bleu nuit", value: "#1e3a8a" },
  { name: "Pétrole", value: "#0f766e" },
  { name: "Lavande", value: "#a5b4fc" },
  { name: "Prune", value: "#7e22ce" },
  { name: "Framboise", value: "#be185d" },
  { name: "Ardoise", value: "#475569" },
  { name: "Taupe", value: "#78716c" },
] as const;

export function isCoachColor(value: string): boolean {
  return COACH_COLORS.some((c) => c.value === value);
}

export function hexToRgba(hex: string, alpha: number): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}
