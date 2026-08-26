"use client";

import { dayName } from "@/lib/dates";
import { ROOMS } from "@/lib/rooms";

export function TemplateFilters({
  dayOfWeek,
  room,
  coachId,
  status,
  coaches,
}: {
  dayOfWeek: string;
  room: string;
  coachId: string;
  status: string;
  coaches: { id: string; name: string }[];
}) {
  const hasFilters = dayOfWeek || room || coachId || status;

  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Jour</label>
        <select
          name="dayOfWeek"
          defaultValue={dayOfWeek}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Tous les jours</option>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {dayName(d)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Salle</label>
        <select
          name="room"
          defaultValue={room}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Toutes les salles</option>
          {ROOMS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
          <option value="none">Non assigné</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Statut</label>
        <select
          name="status"
          defaultValue={status}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </select>
      </div>
      {hasFilters && (
        <a
          href="/admin/templates"
          className="pb-2 text-xs text-neutral-500 hover:text-white"
        >
          Effacer les filtres
        </a>
      )}
    </form>
  );
}
