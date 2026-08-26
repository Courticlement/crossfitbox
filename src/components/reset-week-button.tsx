"use client";

import { resetWeek } from "@/lib/actions/planning";

export function ResetWeekButton({ weekStart }: { weekStart: string }) {
  return (
    <form
      action={resetWeek}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Supprimer tous les cours prévus pour cette semaine ? Les cours déjà marqués Fait, Manqué ou Annulé sont conservés. Cette action est irréversible."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <button
        type="submit"
        className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-950/60"
      >
        Réinitialiser cette semaine
      </button>
    </form>
  );
}
