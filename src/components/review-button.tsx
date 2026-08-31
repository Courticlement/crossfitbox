import Link from "next/link";
import { pastilleColor } from "@/lib/review-constants";

// Sits in the class block's header row (see WeekGrid's headerAction) next to
// DeleteClassButton — a plain clipboard link into the review wizard for an
// unreviewed class, or the saved pastille color linking into its detail page
// once one exists. Kept as a server component (no "use client") since it's
// just a Link either way.
export function ReviewButton({
  classInstanceId,
  review,
  weekParam,
}: {
  classInstanceId: string;
  review: { id: string; pastille: string } | null;
  // Preserves ?week= on the way back from the wizard so cancelling (or
  // finishing) a review returns to the same week instead of snapping to
  // the current one.
  weekParam: string;
}) {
  if (review) {
    const color = pastilleColor(review.pastille);
    return (
      <Link
        href={`/admin/reviews/${review.id}`}
        title="Voir la review de ce cours"
        className="flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide"
        style={{ borderColor: `${color}73`, backgroundColor: `${color}29`, color }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        Reviewée
      </Link>
    );
  }

  return (
    <Link
      href={`/admin/planning/review/${classInstanceId}?week=${weekParam}`}
      title="Démarrer une review de coaching"
      className="shrink-0 text-[10px] text-neutral-500 opacity-0 hover:text-white group-hover:opacity-100"
      aria-label="Démarrer une review de coaching"
    >
      📋
    </Link>
  );
}
