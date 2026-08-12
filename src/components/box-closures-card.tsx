import { formatDayLabel, formatDateISO } from "@/lib/dates";
import { closeDay, reopenDay } from "@/lib/actions/planning";

export type BoxClosureEntry = {
  id: string;
  date: Date;
  note: string | null;
};

// Not tied to any particular displayed week — unlike the ad-hoc-class card
// alongside it, a closure can be set for any date, so it always lists every
// upcoming closure regardless of which week Planning is currently showing.
export function BoxClosuresCard({ entries }: { entries: BoxClosureEntry[] }) {
  return (
    <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-medium text-white">Box closed (holiday, etc.)</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Closing a day skips it when generating from templates and cancels any
        classes already planned on it.
      </p>

      <form action={closeDay} className="flex flex-col gap-2">
        <input
          type="date"
          name="date"
          required
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
        <input
          type="text"
          name="note"
          maxLength={280}
          placeholder="Note (optional), e.g. Christmas Day"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-950/60"
        >
          Close this day
        </button>
      </form>

      {entries.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-neutral-800 pt-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-300"
            >
              <span>
                {formatDayLabel(entry.date)}
                {entry.note && ` · ${entry.note}`}
              </span>
              <form action={reopenDay}>
                <input type="hidden" name="date" value={formatDateISO(entry.date)} />
                <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                  Reopen
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
