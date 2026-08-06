"use client";

export function PlanningFilters({
  week,
  coachId,
  type,
  coaches,
}: {
  week: string;
  coachId: string;
  type: string;
  coaches: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
      <input type="hidden" name="week" value={week} />
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Coach</label>
        <select
          name="coachId"
          defaultValue={coachId}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">All coaches</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Type</label>
        <select
          name="type"
          defaultValue={type}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">All classes</option>
          <option value="private">Private only</option>
          <option value="group">Group only</option>
        </select>
      </div>
      {(coachId || type) && (
        <a
          href={`/admin/planning?week=${week}`}
          className="pb-2 text-xs text-neutral-500 hover:text-white"
        >
          Clear filters
        </a>
      )}
    </form>
  );
}
