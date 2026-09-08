"use client";

import { useState } from "react";
import { addPrivateClass } from "@/lib/actions/submissions";
import { formatDayLabel, formatDateISO, addDays } from "@/lib/dates";

// Mobile-only shortcut for the same add flow as PrivateClassForm's inline
// form — that form lives mid-page, past the week nav and unavailability
// card, which is a lot of scrolling on a phone just to log a private
// lesson. Desktop already has the inline form in easy reach, so this stays
// md:hidden rather than duplicating the affordance there too.
export function PrivateClassFab({
  coachId,
  weekStart,
  locked,
}: {
  coachId: string;
  weekStart: Date;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Nothing to shortcut to once the week's locked — PrivateClassForm's own
  // fields are disabled for the same reason.
  if (locked) return null;

  const weekStartStr = formatDateISO(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajouter un cours privé"
        className="fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl leading-none font-medium text-neutral-950 shadow-lg shadow-black/50 hover:bg-neutral-200 md:hidden"
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-xl border-t border-neutral-800 bg-neutral-900 p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Ajouter un cours privé</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Closes on submit rather than waiting on the action's result —
                the sheet is a quick-add shortcut, and the entry still shows
                up in PrivateClassForm's own list below once the page
                revalidates, same as submitting that form directly would. */}
            <form
              action={addPrivateClass}
              onSubmit={() => setOpen(false)}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="coachId" value={coachId} />
              <input type="hidden" name="weekStart" value={weekStartStr} />
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Jour</label>
                <select
                  name="dayOfWeek"
                  required
                  defaultValue=""
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Choisir le jour
                  </option>
                  {days.map((day, idx) => (
                    <option key={formatDateISO(day)} value={idx + 1}>
                      {formatDayLabel(day)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-neutral-500">Début</label>
                  <input
                    type="time"
                    name="startTime"
                    required
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-neutral-500">Fin</label>
                  <input
                    type="time"
                    name="endTime"
                    required
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
              >
                Ajouter
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
