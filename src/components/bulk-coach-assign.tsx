"use client";

import { createContext, useContext, useRef, useState, useActionState } from "react";
import {
  bulkAssignCoach,
  bulkAddAssistant,
  type BulkAssignState,
  type BulkAssistantState,
} from "@/lib/actions/planning";

const initialAssignState: BulkAssignState = { error: null, assigned: 0 };
const initialAssistState: BulkAssistantState = { error: null, assigned: 0 };

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
};

const BulkAssignContext = createContext<Ctx | null>(null);

// Selection checkbox dropped into each WeekGrid block via its
// selectionAction prop. Renders nothing outside a BulkAssignProvider.
export function SelectClassCheckbox({ id }: { id: string }) {
  const ctx = useContext(BulkAssignContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      // Only ever rendered inside admin/planning's (light) WeekGrid — see
      // this component's own header comment.
      className="size-3 shrink-0 rounded border-neutral-400 bg-white"
      title="Sélectionner pour agir sur plusieurs cours à la fois"
    />
  );
}

// Wraps the Planning grid: owns the multi-select state and renders the
// toolbar to reassign the coach on every selected class at once (there's no
// per-class control for it on the grid itself). Marking classes Fait/Done
// only ever happens for the whole week at once, via "Valider le planning"
// (see validateWeek in actions/planning.ts) — not here. The checkboxes live
// deep inside the (server-rendered) WeekGrid tree passed as children — they
// reach this state through context, same pattern as any client provider
// wrapping server-component children in the App Router.
export function BulkAssignProvider({
  coaches,
  children,
}: {
  coaches: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignState, assignAction] = useActionState(bulkAssignCoach, initialAssignState);
  const [assistState, assistAction] = useActionState(bulkAddAssistant, initialAssistState);
  const [assistPicked, setAssistPicked] = useState<Set<string>>(new Set());
  const assistDialogRef = useRef<HTMLDialogElement>(null);

  // Once either submit round-trips (its state identity changes), the
  // action is done — clear the selection so stale checkboxes don't linger.
  const [synced, setSynced] = useState({ assignState, assistState });
  if (synced.assignState !== assignState || synced.assistState !== assistState) {
    setSynced({ assignState, assistState });
    setSelected(new Set());
    setAssistPicked(new Set());
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const idInputs = [...selected].map((id) => (
    <input key={id} type="hidden" name="ids" value={id} />
  ));

  return (
    <BulkAssignContext.Provider value={{ selected, toggle }}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-2 text-sm">
        <span className="text-neutral-400">
          {selected.size > 0
            ? `${selected.size} cours sélectionné(s)`
            : "Cochez des cours pour agir sur plusieurs à la fois"}
        </span>

        <form action={assignAction} className="flex items-center gap-2">
          {idInputs}
          <select
            name="coachId"
            defaultValue=""
            disabled={selected.size === 0}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Non assigné</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={selected.size === 0}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Assigner
          </button>
        </form>

        <div className="h-5 w-px self-stretch bg-neutral-800" />

        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => assistDialogRef.current?.showModal()}
          className="rounded-md border border-teal-800 bg-teal-950/30 px-3 py-1.5 text-xs text-teal-300 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          🤝 Assistant(s)…
        </button>

        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
          >
            Annuler la sélection
          </button>
        )}

        {assignState.error && <span className="text-xs text-amber-400">{assignState.error}</span>}
        {!assignState.error && assignState.assigned > 0 && (
          <span className="text-xs text-emerald-400">{assignState.assigned} coach(s) mis à jour.</span>
        )}
        {!assistState.error && assistState.assigned > 0 && (
          <span className="text-xs text-emerald-400">
            {assistState.assigned} assistanat(s) ajouté(s).
          </span>
        )}
      </div>

      <dialog
        ref={assistDialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) assistDialogRef.current?.close();
        }}
        // Same centering fix as CopyLastWeekButton's popin — Tailwind's
        // preflight zeroes every element's margin, defeating the browser's
        // default `dialog:modal { margin: auto }`.
        className="fixed inset-0 m-auto w-72 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-neutral-300 backdrop:bg-black/60"
      >
        <form
          action={assistAction}
          onSubmit={() => assistDialogRef.current?.close()}
          className="flex flex-col gap-3"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <h3 className="text-sm font-semibold text-white">
            Ajouter comme assistant sur {selected.size} cours sélectionné(s)
          </h3>
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {coaches.map((coach) => {
              const checked = assistPicked.has(coach.id);
              return (
                <label key={coach.id} className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    name="coachIds"
                    value={coach.id}
                    checked={checked}
                    onChange={(e) => {
                      setAssistPicked((prev) => {
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
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => assistDialogRef.current?.close()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={assistPicked.size === 0}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </form>
      </dialog>

      {children}
    </BulkAssignContext.Provider>
  );
}
