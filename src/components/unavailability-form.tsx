"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { submitUnavailability, deleteUnavailability } from "@/lib/actions/availability";
import { formatDayLabel, dayName } from "@/lib/dates";

function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending…" : "Let the admin know"}
    </button>
  );
}

export type UnavailabilityEntry = {
  id: string;
  startDate: Date;
  endDate: Date;
  recurring: boolean;
  note: string | null;
};

// Not tied to any particular week — unlike PrivateClassForm, this covers
// upcoming dates the coach won't be around, so it's shown once per page
// regardless of which week the grid below is on.
export function UnavailabilityForm({
  coachId,
  entries,
}: {
  coachId: string;
  entries: UnavailabilityEntry[];
}) {
  const [recurring, setRecurring] = useState(false);

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-medium text-white">Time off / unavailable</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Flag any upcoming dates you won&apos;t be able to coach — the admin is
        notified right away.
      </p>

      <form action={submitUnavailability} className="mb-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="coachId" value={coachId} />
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            {recurring ? "Every week, starting" : "From"}
          </label>
          <input
            type="date"
            name="startDate"
            required
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
        </div>
        {!recurring && (
          <div>
            <label className="mb-1 block text-xs text-neutral-500">To</label>
            <input
              type="date"
              name="endDate"
              required
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>
        )}
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-xs text-neutral-500">Note (optional)</label>
          <input
            type="text"
            name="note"
            maxLength={280}
            placeholder="e.g. vacation"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <SubmitButton />
        <label className="mb-2 flex w-full items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            name="recurring"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-950"
          />
          Repeats weekly (permanent time off, until cancelled)
        </label>
      </form>

      {entries.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-neutral-800 pt-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-300"
            >
              <span>
                {entry.recurring ? (
                  <>
                    Every {dayName(isoWeekday(entry.startDate))} · starting{" "}
                    {formatDayLabel(entry.startDate)}
                  </>
                ) : (
                  <>
                    {formatDayLabel(entry.startDate)}
                    {entry.startDate.getTime() !== entry.endDate.getTime() &&
                      ` – ${formatDayLabel(entry.endDate)}`}
                  </>
                )}
                {entry.note && ` · ${entry.note}`}
              </span>
              <form action={deleteUnavailability}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="coachId" value={coachId} />
                <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                  Cancel
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
