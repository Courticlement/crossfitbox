"use client";

import { useState } from "react";

// Checkbox group for the "select all or several coaches" step ahead of the
// PDF export — plain checkboxes named coachId so the enclosing <form
// method="get" action="/admin/reviews/export/pdf"> submits them as
// repeated query params with no server action needed. All coaches start
// selected, since "export everything" is the common case.
export function ReviewExportCoachPicker({
  coaches,
}: {
  coaches: { id: string; name: string; archived: boolean }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(coaches.map((c) => c.id)));
  const allSelected = selected.size === coaches.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(coaches.map((c) => c.id)));
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
    <div>
      <button
        type="button"
        onClick={toggleAll}
        className="mb-3 text-sm text-neutral-400 underline hover:text-white"
      >
        {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
      </button>
      <div className="flex flex-col gap-2">
        {coaches.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white hover:border-neutral-600"
          >
            <input
              type="checkbox"
              name="coachId"
              value={c.id}
              checked={selected.has(c.id)}
              onChange={() => toggleOne(c.id)}
              className="h-4 w-4 accent-white"
            />
            {c.name}
            {c.archived && <span className="text-xs text-neutral-500">(archivé)</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
