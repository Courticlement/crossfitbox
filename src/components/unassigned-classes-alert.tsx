import Link from "next/link";
import { formatDayLabel, formatDateISO, startOfWeekMonday } from "@/lib/dates";
import { getUnassignedClasses } from "@/lib/unassigned-classes";

// Shown on the admin Dashboard and Planning pages, same placement as
// UnavailabilityAlert/PendingClaimsPanel — upcoming group classes with
// nobody assigned yet. Links into the Planning grid (same highlight+scroll
// mechanism as DashboardCoachCards' "Review 0" link) rather than assigning
// inline, since that's where CoachSelect and the scheduling-conflict check
// already live (see assignCoach in actions/planning.ts). Nothing to
// acknowledge/dismiss the way Unavailability's "Compris" works — an
// unfilled slot just drops off the list once it has a coach.
// Past a handful of unfilled slots, listing every single one is more noise
// than signal — collapse them behind a native <details> disclosure so the
// alert takes one line until an admin actually wants to work through it.
const CONDENSE_THRESHOLD = 5;

export async function UnassignedClassesAlert({ organizationId }: { organizationId: string }) {
  const classes = await getUnassignedClasses(organizationId);
  if (classes.length === 0) return null;

  const heading = (
    <>
      {classes.length} cours collectif{classes.length === 1 ? "" : "s"} sans coach assigné
    </>
  );

  const list = (
    <ul className="flex flex-col gap-1.5">
      {classes.map((cls) => (
        <li
          key={cls.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-800/60 bg-red-950/40 px-2 py-1.5"
        >
          <span>
            <strong className="text-red-100">{cls.label}</strong> —{" "}
            {formatDayLabel(cls.date)} {cls.startTime}–{cls.endTime} ({cls.room.name})
          </span>
          <Link
            href={`/admin/planning?week=${formatDateISO(startOfWeekMonday(cls.date))}&highlight=${cls.id}`}
            className="shrink-0 text-xs font-medium text-white underline hover:text-red-100"
          >
            Assigner →
          </Link>
        </li>
      ))}
    </ul>
  );

  if (classes.length > CONDENSE_THRESHOLD) {
    return (
      <details className="mb-6 rounded-md border-2 border-red-600 bg-red-950 px-3 py-2 text-sm text-red-200">
        <summary className="cursor-pointer select-none font-medium text-white">
          {heading}
        </summary>
        <div className="mt-2">{list}</div>
      </details>
    );
  }

  return (
    <div className="mb-6 rounded-md border-2 border-red-600 bg-red-950 px-3 py-2 text-sm text-red-200">
      <p className="mb-2 font-medium text-white">{heading}</p>
      {list}
    </div>
  );
}
