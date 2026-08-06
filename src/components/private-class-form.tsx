"use client";

import { useFormStatus } from "react-dom";
import { addPrivateClass, deletePrivateClass } from "@/lib/actions/submissions";
import { formatDayLabel, formatDateISO, addDays } from "@/lib/dates";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

export type PrivateClassEntry = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
};

export function PrivateClassForm({
  coachId,
  weekStart,
  entries,
}: {
  coachId: string;
  weekStart: Date;
  entries: PrivateClassEntry[];
}) {
  const weekStartStr = formatDateISO(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-medium text-white">
        Private classes you gave this week
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Log a private lesson that isn&apos;t on the regular schedule — pick
        the day and time, it&apos;s recorded as done.
      </p>

      <form action={addPrivateClass} className="mb-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="coachId" value={coachId} />
        <input type="hidden" name="weekStart" value={weekStartStr} />
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Day</label>
          <select
            name="dayOfWeek"
            required
            defaultValue=""
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          >
            <option value="" disabled>
              Select day
            </option>
            {days.map((day, idx) => (
              <option key={formatDateISO(day)} value={idx + 1}>
                {formatDayLabel(day)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Start</label>
          <input
            type="time"
            name="startTime"
            required
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">End</label>
          <input
            type="time"
            name="endTime"
            required
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <AddButton />
      </form>

      {entries.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-neutral-800 pt-3">
          {entries
            .slice()
            .sort(
              (a, b) =>
                formatDateISO(a.date).localeCompare(formatDateISO(b.date)) ||
                a.startTime.localeCompare(b.startTime)
            )
            .map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-300"
              >
                <span>
                  {formatDayLabel(entry.date)} · {entry.startTime}–{entry.endTime}
                </span>
                <form action={deletePrivateClass}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="coachId" value={coachId} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
