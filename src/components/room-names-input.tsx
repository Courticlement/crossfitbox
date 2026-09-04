"use client";

import { useState } from "react";

let nextRowId = 0;

// A dynamic add/remove list of room-name text inputs, all posted under the
// same `roomName` field name (read via formData.getAll("roomName") in
// createOrganization) — used when creating a new box, since the admin
// defines however many rooms it has right there. Rows are keyed by a
// stable id (not their index) so removing one row doesn't shift another
// row's already-typed text into a different DOM node.
export function RoomNamesInput() {
  const [rowIds, setRowIds] = useState(() => [nextRowId++, nextRowId++]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="mb-1 block text-xs text-neutral-500">Salles</span>
      {rowIds.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5">
          <input
            type="text"
            name="roomName"
            required
            placeholder={`Salle ${i + 1}`}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          {rowIds.length > 1 && (
            <button
              type="button"
              onClick={() => setRowIds((ids) => ids.filter((rowId) => rowId !== id))}
              className="shrink-0 rounded-md border border-neutral-700 px-2 py-2 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
            >
              Retirer
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRowIds((ids) => [...ids, nextRowId++])}
        className="self-start rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
      >
        + Ajouter une salle
      </button>
    </div>
  );
}
