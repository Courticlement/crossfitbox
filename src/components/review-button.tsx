import Link from "next/link";
import { pastilleColor, pastilleLabel } from "@/lib/review-constants";

// The reviewed-status indicator — a small pastille-colored dot linking into
// the review's detail page (not a text pill — see week-dashboard's
// reviewCount pastilles for the same pattern). Rendered by each grid
// wherever it fits that layout (WeekGrid puts it under the class label,
// DayAgenda in its header badge row) rather than living inside ReviewButton
// itself: it used to sit in WeekGrid's absolutely-positioned corner next to
// the hour label, always visible while Edit/Delete only reveal on hover —
// besides colliding with those icons on narrow room lanes, it was sitting
// on top of the class's start time instead of near the class it belongs to.
export function ReviewDot({ review }: { review: { id: string; pastille: string } }) {
  const color = pastilleColor(review.pastille);
  return (
    <Link
      href={`/admin/reviews/${review.id}`}
      title={`Reviewée · ${pastilleLabel(review.pastille)}`}
      aria-label="Voir la review de ce cours"
      className="flex shrink-0 items-center justify-center rounded-md p-1 md:p-0.5"
    >
      <span className="h-2 w-2 rounded-full ring-1 ring-inset ring-white/30" style={{ backgroundColor: color }} />
    </Link>
  );
}

// Sits in the class block's header row (see WeekGrid's headerAction) next to
// DeleteClassButton — a plain clipboard link into the review wizard for an
// unreviewed class. Once a review exists this renders nothing here (see
// ReviewDot above, rendered separately by the caller) since there's no more
// "start a review" action to offer. Kept as a server component (no "use
// client") since it's just a Link either way.
export function ReviewButton({
  classInstanceId,
  review,
  weekParam,
  light = false,
}: {
  classInstanceId: string;
  review: { id: string; pastille: string } | null;
  // Preserves ?week= on the way back from the wizard so cancelling (or
  // finishing) a review returns to the same week instead of snapping to
  // the current one.
  weekParam: string;
  // Matches WeekGrid/DayAgenda's own `light` switch — this button sits
  // inside their cards, so its hover color has to flip too or it goes
  // invisible against a white card (see admin/planning's usage).
  light?: boolean;
}) {
  if (review) {
    return null;
  }

  return (
    <Link
      href={`/admin/planning/review/${classInstanceId}?week=${weekParam}`}
      title="Démarrer une review de coaching"
      // Visible by default — a touch screen has no hover state to reveal
      // it. Only fades in on hover once there's room for a full week grid
      // (see WeekGrid, whose event blocks carry the `group` class this
      // relies on at md+).
      className={`shrink-0 rounded-md p-1 text-base text-neutral-500 md:p-0 md:text-[10px] md:opacity-0 md:group-hover:opacity-100 ${light ? "hover:text-neutral-900" : "hover:text-white"}`}
      aria-label="Démarrer une review de coaching"
    >
      📋
    </Link>
  );
}
