"use client";

import Link from "next/link";
import { PASTILLES } from "@/lib/review-constants";

export function ReviewFilters({
  from,
  to,
  coachId,
  pastille,
  coaches,
}: {
  from: string;
  to: string;
  coachId: string;
  pastille: string;
  coaches: { id: string; name: string }[];
}) {
  const hasFilters = coachId || pastille;

  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Du</label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Au</label>
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
          <option value="">Tous les coachs</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Pastille</label>
        <select
          name="pastille"
          defaultValue={pastille}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Toutes les pastilles</option>
          {PASTILLES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
      >
        Appliquer
      </button>
      {(hasFilters || from || to) && (
        <Link href="/admin/reviews" className="pb-2 text-xs text-neutral-500 hover:text-white">
          Réinitialiser
        </Link>
      )}
    </form>
  );
}
