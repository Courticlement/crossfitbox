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
        className="shrink-0 text-[10px] text-neutral-500 opacity-0 hover:text-red-300 group-hover:opacity-100"
      >
        ✕
      </button>
    </form>
  );
}
