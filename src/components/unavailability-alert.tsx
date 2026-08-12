import { formatDayLabel } from "@/lib/dates";
import { getPendingUnavailability } from "@/lib/unavailability-alerts";
import { acknowledgeUnavailability } from "@/lib/actions/availability";

function formatRange(startDate: Date, endDate: Date): string {
  return startDate.getTime() === endDate.getTime()
    ? formatDayLabel(startDate)
    : `${formatDayLabel(startDate)} – ${formatDayLabel(endDate)}`;
}

// The onsite half of the time-off notification (see submitUnavailability
// for the emailed half) — shown on the admin Dashboard and Planning pages
// so it's visible wherever the admin would actually act on it. Each entry
// stays until acknowledged, even across page visits.
export async function UnavailabilityAlert() {
  const entries = await getPendingUnavailability();
  if (entries.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
      <p className="mb-2 font-medium text-amber-200">
        {entries.length} coach{entries.length === 1 ? "" : "es"} flagged time off
      </p>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-900/60 bg-amber-950/40 px-2 py-1.5"
          >
            <span>
              <strong className="text-amber-100">{entry.coach.name}</strong>{" "}
              {formatRange(entry.startDate, entry.endDate)}
              {entry.note && <span className="text-amber-400"> — {entry.note}</span>}
            </span>
            <form action={acknowledgeUnavailability}>
              <input type="hidden" name="id" value={entry.id} />
              <button
                type="submit"
                className="shrink-0 text-xs text-amber-200 underline hover:text-white"
              >
                Got it
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
