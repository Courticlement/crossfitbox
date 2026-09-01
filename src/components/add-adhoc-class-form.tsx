"use client";

import { useState } from "react";
import { addAdHocClass } from "@/lib/actions/planning";
import { addDays, formatDateISO } from "@/lib/dates";
import { ROOMS } from "@/lib/rooms";

// A team event has no single coach, so checking it disables (and visually
// clears) the coach field instead of leaving a stale selection that looks
// like it'll be honored — the server action ignores it either way (see
// addAdHocClass), this is purely so the form doesn't lie about what it'll do.
export function AddAdHocClassForm({
  weekStart,
  coaches,
}: {
  weekStart: Date;
  coaches: { id: string; name: string; archived: boolean }[];
}) {
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  return (
    <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-white">Ajouter un cours ponctuel</h2>
      <form action={addAdHocClass} className="flex flex-col gap-2">
        <input
          type="date"
          name="date"
          required
          defaultValue={formatDateISO(weekStart)}
          min={formatDateISO(weekStart)}
          max={formatDateISO(addDays(weekStart, 6))}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="time"
            name="startTime"
            required
            className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
          <input
            type="time"
            name="endTime"
            required
            className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <select
          name="room"
          required
          defaultValue=""
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="" disabled>
            Salle
          </option>
          {ROOMS.map((room) => (
            <option key={room} value={room}>
              {room}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="label"
          required
          placeholder="Intitulé"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" name="isPrivate" className="accent-white" />
          Cours privé
        </label>
        <label className="flex items-center gap-1.5 rounded-md border border-amber-800/60 bg-amber-950/20 px-2 py-1.5 text-sm font-medium text-amber-300">
          <input
            type="checkbox"
            name="isTeamEvent"
            checked={isTeamEvent}
            onChange={(e) => setIsTeamEvent(e.target.checked)}
            className="accent-amber-400"
          />
          🎉 Événement d&apos;équipe (tous les coachs)
        </label>
        <select
          name="coachId"
          defaultValue=""
          disabled={isTeamEvent}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none disabled:opacity-40"
        >
          <option value="">Coach — à assigner plus tard</option>
          {coaches
            .filter((c) => !c.archived)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        {isTeamEvent && (
          <p className="text-xs text-amber-400/80">
            Visible pour tous les coachs sur Mes cours — ne compte dans le quota ni la paie de
            personne.
          </p>
        )}
        <button
          type="submit"
          className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Ajouter le cours
        </button>
      </form>
    </div>
  );
}
