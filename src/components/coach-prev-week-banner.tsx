import Link from "next/link";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { getCoachPrevWeekAlert } from "@/lib/prev-week-alert";

// Nudges a coach to go report last week's classes before the admin
// validates (and locks) that week — see getCoachPrevWeekAlert for exactly
// when this fires.
export async function CoachPrevWeekBanner({
  coachId,
  weekHref = (week) => `/upload?week=${week}&coachId=${coachId}`,
}: {
  coachId: string;
  // Lets the private per-coach page (/upload/[token]) point "Report last
  // week" back at itself instead of the shared /upload?coachId= dropdown
  // page, so the coach never leaves their private link.
  weekHref?: (weekISO: string) => string;
}) {
  const { show, prevWeekStart, unreportedMine } = await getCoachPrevWeekAlert(coachId);
  if (!show) return null;

  return (
    <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
      ⚠ You still have {unreportedMine} class{unreportedMine === 1 ? "" : "es"}{" "}
      from last week ({formatDayLabel(prevWeekStart)} –{" "}
      {formatDayLabel(addDays(prevWeekStart, 6))}) you haven&apos;t reported
      yet. Report them before the admin validates the week.{" "}
      <Link
        href={weekHref(formatDateISO(prevWeekStart))}
        className="font-medium text-amber-100 underline hover:text-white"
      >
        Report last week →
      </Link>
    </p>
  );
}
