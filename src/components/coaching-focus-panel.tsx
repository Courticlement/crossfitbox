import Link from "next/link";
import { formatDayLabel } from "@/lib/dates";
import type { LastFocus } from "@/lib/coaching-focus";

// One card per coach who's ever been reviewed, showing the standing focus
// from their most recent review — independent of whatever Coach/date/
// pastille filter the page below it has applied, same reasoning as the
// evolution chart: this answers "what matters right now", not "what's in
// this slice of history".
export function CoachingFocusPanel({
  items,
}: {
  items: { coachId: string; coachName: string; coachColor: string | null; focus: LastFocus }[];
}) {
  if (!items.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="mb-1 text-sm font-semibold text-white">Axes de travail en cours</h3>
      <p className="mb-3 text-xs text-neutral-500">
        Le dernier axe donné à chaque coach — jusqu&apos;à sa prochaine review.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.coachId}
            href={`/admin/reviews/${item.focus.reviewId}`}
            className="flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 hover:border-neutral-600"
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.coachColor ?? "#71717a" }}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-white">
                {item.coachName}{" "}
                <span className="font-mono font-normal text-neutral-500">
                  · {formatDayLabel(item.focus.date)}
                </span>
              </span>
              <span className="line-clamp-2 block text-xs leading-snug text-neutral-400">
                {item.focus.focusText}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
