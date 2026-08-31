import type { ReactNode } from "react";
import {
  SEGMENTS,
  PILLARS,
  pillarRatingColor,
  pastilleColor,
  pastilleLabel,
  type PillarKey,
  type PillarRating,
} from "@/lib/review-constants";

// Plain presentational read-out of one review's content — shared by the
// wizard's own Récap step (fed live draft state) and the saved review's
// detail page (fed the persisted row) so the two never drift apart.
export function ReviewRecap({
  segments,
  pillars,
  identifiedText,
  focusText,
  pastille,
}: {
  segments: Partial<Record<string, string | null>>;
  pillars: Partial<Record<PillarKey, PillarRating | null>>;
  identifiedText: string | null;
  focusText: string;
  pastille: string | null;
}) {
  return (
    <div>
      <RecapSection title="Déroulé du cours">
        {SEGMENTS.map((seg) => (
          <p key={seg.key} className="mb-2 text-[13.5px] leading-relaxed text-neutral-400">
            <b style={{ color: seg.accent }}>{seg.title}.</b> {segments[seg.key] || "—"}
          </p>
        ))}
      </RecapSection>

      <RecapSection title="Piliers">
        <div className="flex flex-wrap gap-2">
          {PILLARS.map((p) => (
            <span
              key={p.key}
              className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillarRatingColor(pillars[p.key]) }} />
              {p.label}
            </span>
          ))}
        </div>
      </RecapSection>

      <RecapSection title="Feedback">
        <p className="mb-2 text-[13.5px] text-neutral-400">
          <b className="text-white">Le coach a identifié — </b>
          {identifiedText || "—"}
        </p>
        <p className="text-[13.5px] text-neutral-400">
          <b className="text-white">Axe de travail — </b>
          {focusText || "—"}
        </p>
      </RecapSection>

      <RecapSection title="Pastille de séance" last>
        {pastille ? (
          <span
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-extrabold"
            style={{ backgroundColor: `${pastilleColor(pastille)}26`, color: pastilleColor(pastille) }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pastilleColor(pastille) }} />
            {pastilleLabel(pastille)}
          </span>
        ) : (
          <span className="text-sm text-neutral-500">Non définie</span>
        )}
      </RecapSection>
    </div>
  );
}

export function RecapSection({ title, last, children }: { title: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={`mb-5 ${last ? "" : "border-b border-neutral-900 pb-5"}`}>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">{title}</h4>
      {children}
    </div>
  );
}
