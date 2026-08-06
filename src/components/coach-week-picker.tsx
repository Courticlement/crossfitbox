"use client";

export function CoachWeekPicker({
  week,
  coachId,
  coaches,
}: {
  week: string;
  coachId: string;
  coaches: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="week" value={week} />
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Coach</label>
        <select
          name="coachId"
          defaultValue={coachId}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Select your name</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
