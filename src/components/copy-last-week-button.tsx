"use client";

import { useRef, useState } from "react";
import { copyLastWeek } from "@/lib/actions/planning";
import { addDays, formatDateISO, formatDayLabel, parseDateOnly } from "@/lib/dates";

// Opens a popin to pick which day(s) of this week get last week's planning
// copied onto them — defaults to all 7 selected so the common "copy the
// whole week" case is still a single click away, but lets the admin narrow
// it down to just the day(s) that actually need it (e.g. only Monday
// changed since last week). See copyLastWeek, which now filters
// sourceInstances down to the selected target dates.
export function CopyLastWeekButton({ weekStart }: { weekStart: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const weekStartDate = parseDateOnly(weekStart) ?? new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const dayIsos = days.map(formatDateISO);
  const [selected, setSelected] = useState<Set<string>>(new Set(dayIsos));
  const allSelected = selected.size === dayIsos.length;

  // Resyncs to "all days" whenever the displayed week changes — same
  // "adjust state during render" pattern as EditClassButton/CoachSelect —
  // so a leftover narrow selection from a previous week's copy doesn't
  // silently carry over and limit this one.
  const [syncedWeekStart, setSyncedWeekStart] = useState(weekStart);
  if (syncedWeekStart !== weekStart) {
    setSyncedWeekStart(weekStart);
    setSelected(new Set(dayIsos));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
      >
        <span className="sm:hidden">Copier</span>
        <span className="hidden sm:inline">Copier la semaine dernière</span>
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        onClose={() => setSelected(new Set(dayIsos))}
        // Tailwind's preflight zeroes out every element's margin, which
        // knocks out the browser's default `dialog:modal { margin: auto }`
        // centering — pin it back explicitly instead of relying on that.
        className="fixed inset-0 m-auto w-80 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-neutral-300 backdrop:bg-black/60"
      >
        <form
          action={copyLastWeek}
          onSubmit={(e) => {
            if (
              !window.confirm(
                "Copier le planning de la semaine précédente vers les jours sélectionnés ? Les cours déjà prévus (Planifié) seront synchronisés. Les cours Fait, Manqué ou Annulé sont conservés."
              )
            ) {
              e.preventDefault();
              return;
            }
            dialogRef.current?.close();
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="weekStart" value={weekStart} />
          <h3 className="text-sm font-semibold text-white">Copier la semaine dernière</h3>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(dayIsos))}
            className="self-start text-xs text-neutral-400 underline decoration-neutral-600 underline-offset-2 hover:text-white"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <div className="flex flex-col gap-1.5">
            {days.map((day) => {
              const iso = formatDateISO(day);
              const checked = selected.has(iso);
              return (
                <label key={iso} className="flex items-center gap-2 text-sm capitalize text-neutral-300">
                  <input
                    type="checkbox"
                    name="days"
                    value={iso}
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(iso);
                        else next.delete(iso);
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 accent-white"
                  />
                  {formatDayLabel(day)}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={selected.size === 0}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Copier {selected.size > 0 && `(${selected.size})`}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
