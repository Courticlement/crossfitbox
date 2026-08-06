"use client";

import { resetWeek } from "@/lib/actions/planning";

export function ResetWeekButton({ weekStart }: { weekStart: string }) {
  return (
    <form
      action={resetWeek}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Delete all planned classes for this week? Classes already marked Done, Missed, or Cancelled are kept. This can't be undone."
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
        Reset this week
      </button>
    </form>
  );
}
