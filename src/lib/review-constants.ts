// Shared vocabulary for the coaching review wizard (/admin/planning/review)
// and its history view (/admin/reviews) — kept in one place since the
// wizard, the recap screens, and the Prisma column names all have to agree
// on the same keys.

export type SegmentKey =
  | "briefing"
  | "generalWu"
  | "specificWu"
  | "skillWod"
  | "coolDown";

// Tailwind color name for each segment's accent (title, textarea border,
// primary button) — reuses the app's existing palette rather than one-off
// hexes, deliberately skipping emerald/red/amber (already DONE/MISSED/warn
// elsewhere) except where the segment itself earns that meaning.
export const SEGMENTS: { key: SegmentKey; title: string; accent: string }[] = [
  { key: "briefing", title: "Briefing", accent: "#3b82f6" }, // blue-500
  { key: "generalWu", title: "General WU", accent: "#f97316" }, // orange-500
  { key: "specificWu", title: "Specific WU", accent: "#a855f7" }, // purple-500
  { key: "skillWod", title: "Skill + WOD", accent: "#f43f5e" }, // rose-500
  { key: "coolDown", title: "Cool Down", accent: "#10b981" }, // emerald-500
];

// Accent used for the two closing steps (Piliers, Feedback) and their
// buttons — a distinct thread from every segment color and from the
// pastille reds/greens below.
export const CLOSING_ACCENT = "#f43f5e"; // rose-500

export type PillarKey =
  | "enseignement"
  | "observation"
  | "correction"
  | "gestionGroupe"
  | "presenceAttitude"
  | "demonstration";

export const PILLARS: { key: PillarKey; label: string }[] = [
  { key: "enseignement", label: "Enseignement" },
  { key: "observation", label: "Observation" },
  { key: "correction", label: "Correction" },
  { key: "gestionGroupe", label: "Gestion de groupe" },
  { key: "presenceAttitude", label: "Présence & Attitude" },
  { key: "demonstration", label: "Démonstration" },
];

export type PillarRating = "ok" | "mid" | "bad";

export const PILLAR_RATINGS: { value: PillarRating; symbol: string; color: string }[] = [
  { value: "ok", symbol: "✓", color: "#22c55e" }, // green-500
  { value: "mid", symbol: "~", color: "#f59e0b" }, // amber-500
  { value: "bad", symbol: "✕", color: "#ef4444" }, // red-500
];

export function pillarRatingColor(value: string | null | undefined): string {
  return PILLAR_RATINGS.find((r) => r.value === value)?.color ?? "#525252";
}

export type PastilleKey = "green" | "yellow" | "orange" | "red";

export const PASTILLES: { key: PastilleKey; label: string; color: string }[] = [
  { key: "green", label: "Vert", color: "#22c55e" },
  { key: "yellow", label: "Jaune", color: "#eab308" },
  { key: "orange", label: "Orange", color: "#f97316" },
  { key: "red", label: "Rouge", color: "#ef4444" },
];

export function pastilleLabel(key: string): string {
  return PASTILLES.find((p) => p.key === key)?.label ?? key;
}

export function pastilleColor(key: string): string {
  return PASTILLES.find((p) => p.key === key)?.color ?? "#525252";
}

// Prisma column name for each pillar — see prisma/schema.prisma's
// ClassReview model. Kept as an explicit map (rather than templating the
// key) so renaming a PillarKey can't silently break the DB mapping.
export const PILLAR_COLUMN: Record<PillarKey, string> = {
  enseignement: "pillarEnseignement",
  observation: "pillarObservation",
  correction: "pillarCorrection",
  gestionGroupe: "pillarGestionGroupe",
  presenceAttitude: "pillarPresenceAttitude",
  demonstration: "pillarDemonstration",
};

// One coaching-quality score per review (0-100), for the Suivi coaching
// evolution chart — ok=100/mid=50/bad=0 averaged across the six pillars.
// Deliberately independent of the pastille: that's a holistic call the
// coach makes, not a pure pillar average, so the two can legitimately
// disagree (see the chart's separate pastille-colored points).
export function reviewScore(review: Record<string, unknown>): number {
  const total = PILLARS.reduce((sum, p) => {
    const value = review[PILLAR_COLUMN[p.key]];
    return sum + (value === "ok" ? 100 : value === "mid" ? 50 : 0);
  }, 0);
  return Math.round(total / PILLARS.length);
}
