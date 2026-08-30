"use client";

import { useState } from "react";
import { deleteClassInstances } from "@/lib/actions/planning";

export type ClassRow = {
  id: string;
  dateLabel: string;
  time: string;
  room: string;
  label: string;
  type: string;
  coachName: string;
  substituteName: string;
  status: string;
  statusColor: string;
};

export function DataClassesTable({ rows }: { rows: ClassRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      action={deleteClassInstances}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer ${selected.size} cours ? Cette action efface aussi les déclarations et heures enregistrées associées.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="size-3.5 rounded border-neutral-600 bg-neutral-950"
          />
          Tout sélectionner
        </label>
        <button
          type="submit"
          disabled={selected.size === 0}
          className="rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
        >
          Supprimer la sélection {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="w-8 px-4 py-2"></th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Heure</th>
              <th className="px-4 py-2 font-medium">Salle</th>
              <th className="px-4 py-2 font-medium">Intitulé</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium">Remplaçant</th>
              <th className="px-4 py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-neutral-800">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    name="ids"
                    value={row.id}
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="size-3.5 rounded border-neutral-600 bg-neutral-950"
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{row.dateLabel}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.time}</td>
                <td className="px-4 py-2">{row.room}</td>
                <td className="px-4 py-2 text-white">{row.label}</td>
                <td className="px-4 py-2">{row.type}</td>
                <td className="px-4 py-2">{row.coachName}</td>
                <td className="px-4 py-2">{row.substituteName}</td>
                <td className={`px-4 py-2 ${row.statusColor}`}>{row.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  Aucun cours sur cette période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
