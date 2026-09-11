"use client";

import { useRef, useState } from "react";
import { setClassAssistants } from "@/lib/actions/planning";

// Per-class assistant picker — a small popin (not a plain <select>, since a
// class can take several assistants at once) opened from a compact button
// on the WeekGrid card. Only ever rendered inside admin/planning's (light)
// WeekGrid, same reasoning as CoachSelect not taking a `light` prop.
export function AssistantSelect({
  classInstanceId,
  coachId,
  assistants,
  coaches,
}: {
  classInstanceId: string;
  // Excluded from the candidate list — assisting your own class isn't a
  // real second pair of hands (see setClassAssistants).
  coachId: string | null;
  assistants: { id: string; name: string }[];
  coaches: { id: string; name: string }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const candidates = coaches.filter((c) => c.id !== coachId);
  const assistantIds = new Set(assistants.map((a) => a.id));
  const [selected, setSelected] = useState<Set<string>>(assistantIds);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected(new Set(assistants.map((a) => a.id)));
          dialogRef.current?.showModal();
        }}
        title="Assistant(s) sur ce cours"
        className={
          assistants.length > 0
            ? "w-full truncate rounded border border-teal-400 bg-teal-50 px-1 py-0.5 text-left text-[10px] font-medium text-teal-800"
            : "w-full truncate rounded border border-dashed border-neutral-300 px-1 py-0.5 text-left text-[10px] text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
        }
      >
        {assistants.length > 0 ? `🤝 ${assistants.map((a) => a.name).join(", ")}` : "+ Assistant"}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        // Same fix as CopyLastWeekButton's popin — Tailwind's preflight
        // zeroes every element's margin, which otherwise defeats the
        // browser's default `dialog:modal { margin: auto }` centering.
        className="fixed inset-0 m-auto w-72 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-neutral-300 backdrop:bg-black/60"
      >
        <form
          action={setClassAssistants}
          onSubmit={() => dialogRef.current?.close()}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={classInstanceId} />
          <h3 className="text-sm font-semibold text-white">Assistant(s) sur ce cours</h3>
          {candidates.length === 0 ? (
            <p className="text-xs text-neutral-500">Aucun autre coach dans ce box.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {candidates.map((coach) => {
                const checked = selected.has(coach.id);
                return (
                  <label key={coach.id} className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      name="coachIds"
                      value={coach.id}
                      checked={checked}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(coach.id);
                          else next.delete(coach.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 accent-teal-500"
                    />
                    {coach.name}
                  </label>
                );
              })}
            </div>
          )}
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
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
