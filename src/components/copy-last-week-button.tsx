"use client";

import { copyLastWeek } from "@/lib/actions/planning";

export function CopyLastWeekButton({ weekStart }: { weekStart: string }) {
  return (
    <form
      action={copyLastWeek}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Copier le planning de la semaine précédente vers cette semaine ? Les cours déjà prévus (Planifié) seront synchronisés sur la semaine précédente. Les cours Fait, Manqué ou Annulé sont conservés."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <button
        type="submit"
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
      >
        <span className="sm:hidden">Copier</span>
        <span className="hidden sm:inline">Copier la semaine dernière</span>
      </button>
    </form>
  );
}
