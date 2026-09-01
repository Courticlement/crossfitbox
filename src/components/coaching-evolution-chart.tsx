import Link from "next/link";
import { PASTILLES, pastilleColor, pastilleLabel } from "@/lib/review-constants";

// Neutral stand-in for a coach with no Coach.color set yet (see the Coaches
// page) — keeps their line/label legible instead of falling back to black.
const FALLBACK_COACH_COLOR = "#71717a";

const MONTH_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
function fmtAxisDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

export type EvolutionPoint = {
  id: string;
  date: Date;
  score: number;
  pastille: string;
  coachId: string;
  coachName: string;
  coachColor: string | null;
};

const W = 860, H = 220, PAD_L = 30, PAD_R = 100, PAD_T = 14, PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R, PLOT_H = H - PAD_T - PAD_B;

export function CoachingEvolutionChart({
  points,
  highlightCoachId,
  currentParams,
}: {
  points: EvolutionPoint[];
  // "" when the Coach filter isn't set — the chart always shows every
  // coach; this only decides who gets emphasized vs dimmed.
  highlightCoachId: string;
  currentParams: { from?: string; to?: string; pastille?: string };
}) {
  const byCoach = new Map<string, EvolutionPoint[]>();
  for (const p of points) {
    const list = byCoach.get(p.coachId) ?? [];
    list.push(p);
    byCoach.set(p.coachId, list);
  }
  for (const list of byCoach.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime());
  const coachIds = [...byCoach.keys()];
  const allSorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (allSorted.length < 2) {
    return (
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold text-white">Évolution de la qualité de coaching</h3>
        <p className="mt-2 text-xs text-neutral-500">
          Pas assez de reviews sur la période pour tracer une évolution.
        </p>
      </div>
    );
  }

  const minDate = allSorted[0].date.getTime();
  const maxDate = allSorted[allSorted.length - 1].date.getTime();
  const span = Math.max(1, maxDate - minDate);
  const xFor = (d: Date) => PAD_L + ((d.getTime() - minDate) / span) * PLOT_W;
  const yFor = (score: number) => PAD_T + (1 - score / 100) * PLOT_H;

  function hrefFor(coachId: string | null) {
    const params = new URLSearchParams();
    if (currentParams.from) params.set("from", currentParams.from);
    if (currentParams.to) params.set("to", currentParams.to);
    if (currentParams.pastille) params.set("pastille", currentParams.pastille);
    if (coachId) params.set("coachId", coachId);
    const qs = params.toString();
    return `/admin/reviews${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Évolution de la qualité de coaching</h3>
        <p className="text-[11.5px] text-neutral-500">Score moyen des 6 piliers par review (ok=100 · mid=50 · bad=0)</p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full overflow-visible"
        role="img"
        aria-label="Évolution du score de coaching par coach, dans le temps"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={yFor(v)} y2={yFor(v)} stroke="#262626" strokeWidth={1} />
            <text x={PAD_L - 8} y={yFor(v) + 3} textAnchor="end" fontSize={10} fontFamily="var(--font-geist-mono)" fill="#737373">
              {v}
            </text>
          </g>
        ))}

        {coachIds.map((coachId) => {
          const pts = byCoach.get(coachId)!;
          const coach = pts[0];
          const color = coach.coachColor ?? FALLBACK_COACH_COLOR;
          const dimmed = highlightCoachId !== "" && highlightCoachId !== coachId;
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.date).toFixed(1)},${yFor(p.score).toFixed(1)}`).join(" ");
          const last = pts[pts.length - 1];
          return (
            <g key={coachId} opacity={dimmed ? 0.22 : 1}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={highlightCoachId === coachId ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.map((p) => (
                // Dot color is the review's own pastille (how that session
                // went) — not the coach's identity color, which the line
                // and end-label already carry.
                <circle
                  key={p.id}
                  cx={xFor(p.date)}
                  cy={yFor(p.score)}
                  r={5}
                  fill={pastilleColor(p.pastille)}
                  stroke="#171717"
                  strokeWidth={2}
                />
              ))}
              <text
                x={xFor(last.date) + 8}
                y={yFor(last.score) + 4}
                fontSize={11}
                fontWeight={700}
                fill={color}
              >
                {coach.coachName}
              </text>
            </g>
          );
        })}

        <text x={PAD_L} y={H - 6} fontSize={10} fontFamily="var(--font-geist-mono)" fill="#737373">
          {fmtAxisDate(allSorted[0].date)}
        </text>
        <text x={PAD_L + PLOT_W} y={H - 6} textAnchor="end" fontSize={10} fontFamily="var(--font-geist-mono)" fill="#737373">
          {fmtAxisDate(allSorted[allSorted.length - 1].date)}
        </text>
      </svg>

      <div className="mt-2.5 flex flex-wrap gap-3.5 border-t border-neutral-800 pt-2.5">
        {coachIds.map((coachId) => {
          const coach = byCoach.get(coachId)![0];
          const color = coach.coachColor ?? FALLBACK_COACH_COLOR;
          const dimmed = highlightCoachId !== "" && highlightCoachId !== coachId;
          return (
            <Link
              key={coachId}
              href={hrefFor(highlightCoachId === coachId ? null : coachId)}
              className={`flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400 hover:text-white ${dimmed ? "opacity-40" : ""}`}
            >
              <i className="inline-block h-0.5 w-3.5 rounded" style={{ background: color }} />
              {coach.coachName}
            </Link>
          );
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-3.5">
        <span className="text-[11.5px] text-neutral-500">Point&nbsp;=</span>
        {PASTILLES.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {pastilleLabel(p.key)}
          </span>
        ))}
      </div>
    </div>
  );
}
