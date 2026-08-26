"use client";

import { COACH_LEVELS } from "@/lib/coach-levels";

export function LevelSelect({
  name,
  defaultValue,
  form,
}: {
  name: string;
  defaultValue: string;
  // Associates this select with a form that lives elsewhere in the DOM (see
  // the `form=` attribute pattern used across the app's bulk-save forms).
  form?: string;
}) {
  return (
    <select
      name={name}
      form={form}
      defaultValue={defaultValue}
      className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white focus:border-neutral-500 focus:outline-none"
    >
      <option value="">Aucun niveau</option>
      {COACH_LEVELS.map((level) => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </select>
  );
}
