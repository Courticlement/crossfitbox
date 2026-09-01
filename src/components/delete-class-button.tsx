"use client";

import { deleteClassInstance } from "@/lib/actions/planning";

export function DeleteClassButton({
  id,
  reported,
}: {
  id: string;
  // Whether this class has already been marked Done or Missed — deleting it
  // cascades away the coach's report history too, so it needs a much
  // louder warning than deleting a still-PLANNED slot.
  reported: boolean;
}) {
  return (
    <form
      action={deleteClassInstance}
      onSubmit={(e) => {
        const message = reported
          ? "Ce cours a déjà été déclaré (Fait/Manqué) — le supprimer efface définitivement les heures enregistrées pour ce coach. Supprimer quand même ?"
          : "Supprimer ce cours ?";
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        // Visible by default, same reasoning as ReviewButton — hidden until
        // hover only applies once WeekGrid's full grid is actually shown.
        className="shrink-0 rounded-md p-1 text-base text-neutral-500 hover:text-red-300 md:p-0 md:text-[10px] md:opacity-0 md:group-hover:opacity-100"
      >
        ✕
      </button>
    </form>
  );
}
