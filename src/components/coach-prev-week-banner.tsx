import Link from "next/link";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { getCoachPrevWeekAlert } from "@/lib/prev-week-alert";

// Nudges a coach to go report last week's classes before the admin
// validates (and locks) that week — see getCoachPrevWeekAlert for exactly
// when this fires.
export async function CoachPrevWeekBanner({
  organizationId,
  coachId,
}: {
  organizationId: string;
  coachId: string;
}) {
  const { show, prevWeekStart, unreportedMine } = await getCoachPrevWeekAlert(organizationId, coachId);
  if (!show) return null;

  return (
    <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
      ⚠ Il vous reste {unreportedMine} cours{" "}
      de la semaine dernière ({formatDayLabel(prevWeekStart)} –{" "}
      {formatDayLabel(addDays(prevWeekStart, 6))}) non déclaré{unreportedMine === 1 ? "" : "s"}.
      Déclarez-les avant que l&apos;admin valide la semaine.{" "}
      <Link
        href={`/upload?week=${formatDateISO(prevWeekStart)}`}
        className="font-medium text-amber-100 underline hover:text-white"
      >
        Déclarer la semaine dernière →
      </Link>
    </p>
  );
}
