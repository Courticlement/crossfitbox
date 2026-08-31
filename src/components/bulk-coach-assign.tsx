"use client";

import { createContext, useContext, useState, useActionState } from "react";
import {
  bulkAssignCoach,
  bulkSetClassStatus,
  type BulkAssignState,
  type BulkStatusState,
} from "@/lib/actions/planning";
import { statusLabel } from "@/lib/status-labels";

const initialAssignState: BulkAssignState = { error: null, assigned: 0 };
const initialStatusState: BulkStatusState = { error: null, updated: 0 };

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
      className="size-3 shrink-0 rounded border-neutral-600 bg-neutral-950"
      title="Sélectionner pour agir sur plusieurs cours à la fois"
    />
  );
}

// Wraps the Planning grid: owns the multi-select state and renders the
// toolbar to act on every selected class at once — reassign their coach, or
// validate them Fait/Manqué (the only way to do either in bulk; there's no
// per-class control for either on the grid itself). The checkboxes live
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
  const [statusState, statusAction] = useActionState(bulkSetClassStatus, initialStatusState);

  // Once either submit round-trips (its state identity changes), that
  // action is done — clear the selection so stale checkboxes don't linger.
  const [synced, setSynced] = useState({ assignState, statusState });
  if (synced.assignState !== assignState || synced.statusState !== statusState) {
    setSynced({ assignState, statusState });
    setSelected(new Set());
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

        <form action={statusAction} className="flex items-center gap-2">
          {idInputs}
          <select
            name="status"
            defaultValue=""
            disabled={selected.size === 0}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              Valider…
            </option>
            <option value="DONE">{statusLabel("DONE")}</option>
            <option value="MISSED">{statusLabel("MISSED")}</option>
            <option value="PLANNED">{statusLabel("PLANNED")}</option>
          </select>
          <button
            type="submit"
            disabled={selected.size === 0}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Valider
          </button>
        </form>

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
        {statusState.updated > 0 && (
          <span className="text-xs text-emerald-400">{statusState.updated} cours validé(s).</span>
        )}
      </div>
      {children}
    </BulkAssignContext.Provider>
  );
}
