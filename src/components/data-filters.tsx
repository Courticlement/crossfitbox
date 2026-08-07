"use client";

export function DataFilters({
  from,
  to,
  coachId,
  status,
  coaches,
}: {
  from: string;
  to: string;
  coachId: string;
  status: string;
  coaches: { id: string; name: string }[];
}) {
  const hasFilters = coachId || status;

  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-neutral-500">From</label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">To</label>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Coach</label>
        <select
          name="coachId"
          defaultValue={coachId}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">All coaches</option>
          <option value="none">Unassigned</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Status</label>
        <select
          name="status"
          defaultValue={status}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="DONE">Done</option>
          <option value="MISSED">Missed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
      >
        Apply
      </button>
      <button
        type="submit"
        formAction="/admin/data/export"
        className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
      >
        Export .xlsx
      </button>
      {(hasFilters || from || to) && (
        <a
          href="/admin/data"
          className="pb-2 text-xs text-neutral-500 hover:text-white"
        >
          Reset to past month
        </a>
      )}
    </form>
  );
}
