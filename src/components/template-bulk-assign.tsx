"use client";

import { createContext, useContext, useState, useActionState } from "react";
import {
  bulkAssignTemplateCoach,
  resetAllTemplateCoaches,
  type BulkAssignTemplateCoachState,
} from "@/lib/actions/templates";

const initialState: BulkAssignTemplateCoachState = { assigned: 0 };

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
};

const TemplateBulkAssignContext = createContext<Ctx | null>(null);

// Selection checkbox for one template row. Renders nothing outside a
// TemplateBulkAssignProvider.
export function SelectTemplateCheckbox({ id }: { id: string }) {
  const ctx = useContext(TemplateBulkAssignContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      className="size-3.5 rounded border-neutral-600 bg-neutral-950"
    />
  );
}

// Header "select all" checkbox — toggles every row currently on the page
// (i.e. whatever the table's filters left visible).
export function SelectAllTemplatesCheckbox({ ids }: { ids: string[] }) {
  const ctx = useContext(TemplateBulkAssignContext);
  if (!ctx) return null;
  const allSelected = ids.length > 0 && ids.every((id) => ctx.selected.has(id));
  const someSelected = ids.some((id) => ctx.selected.has(id));
  return (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = someSelected && !allSelected;
      }}
      onChange={() => {
        for (const id of ids) {
          const isSelected = ctx.selected.has(id);
          if (allSelected ? isSelected : !isSelected) ctx.toggle(id);
        }
      }}
      className="size-3.5 rounded border-neutral-600 bg-neutral-950"
    />
  );
}

// Wraps the templates table: owns the multi-select state and renders the
// toolbar to reassign several rows' default coach at once, plus the
// unconditional "reset every template's coach" button. The row checkboxes
// live inside the (server-rendered) table passed as children — they reach
// this state through context, same pattern as the Planning grid's
// BulkAssignProvider.
export function TemplateBulkAssignProvider({
  coaches,
  children,
}: {
  coaches: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState(bulkAssignTemplateCoach, initialState);

  // Once the submit round-trips (state identity changes), clear the
  // selection so stale checkboxes don't linger.
  const [synced, setSynced] = useState(state);
  if (synced !== state) {
    setSynced(state);
    setSelected(new Set());
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <TemplateBulkAssignContext.Provider value={{ selected, toggle }}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-2 text-sm">
        <span className="text-neutral-400">
          {selected.size > 0
            ? `${selected.size} créneau(x) sélectionné(s)`
            : "Cochez des créneaux pour changer leur coach en une fois"}
        </span>
        <form action={formAction} className="flex items-center gap-2">
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
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
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
          >
            Annuler la sélection
          </button>
        )}
        {state.assigned > 0 && (
          <span className="text-xs text-emerald-400">{state.assigned} créneau(x) mis à jour.</span>
        )}

        <form
          action={resetAllTemplateCoaches}
          className="ml-auto"
          onSubmit={(e) => {
            if (
              !window.confirm(
                "Retirer le coach assigné de TOUS les créneaux hebdomadaires (y compris inactifs) ? Cette action est irréversible."
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60"
          >
            Réinitialiser tous les coachs
          </button>
        </form>
      </div>
      {children}
    </TemplateBulkAssignContext.Provider>
  );
}
