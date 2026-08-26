import { COACH_COLORS } from "@/lib/coach-colors";

// A color already used by another coach is left out of the options
// entirely, so it's impossible to pick a clash from the UI — Coach.color's
// unique constraint (see schema.prisma) is just the backstop for a race
// between two saves, not the primary guard.
export function ColorSelect({
  name,
  defaultValue,
  takenColors,
}: {
  name: string;
  defaultValue: string;
  takenColors: Set<string>;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white focus:border-neutral-500 focus:outline-none"
    >
      <option value="">Aucune couleur</option>
      {COACH_COLORS.filter((c) => c.value === defaultValue || !takenColors.has(c.value)).map((c) => (
        <option key={c.value} value={c.value}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
