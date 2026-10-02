"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { removeGuestCoach, updateClassInstance, type UpdateClassState } from "@/lib/actions/planning";

const initialState: UpdateClassState = { error: null };

// Lets the admin fix a class's name/time in place instead of deleting it and
// re-adding a new one — see updateClassInstance, which only ever touches
// this one ClassInstance and never the ClassTemplate it may have been
// generated from.
export function EditClassButton({
  classInstanceId,
  label,
  startTime,
  endTime,
  guestName,
  light = false,
}: {
  classInstanceId: string;
  label: string;
  startTime: string;
  endTime: string;
  // Set only when this class is taught by a guest coach (Coach.isGuest) —
  // adds a field to rename that guest (see updateClassInstance).
  guestName?: string;
  // Matches WeekGrid/DayAgenda's own `light` switch — this button sits
  // inside their cards, so its hover color has to flip too or it goes
  // invisible against a white card (see admin/planning's usage).
  light?: boolean;
}) {
  const [state, formAction] = useActionState(updateClassInstance, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initial = { label, startTime, endTime, guestName: guestName ?? "" };
  const [fields, setFields] = useState(initial);

  // Resyncs the form to the server-confirmed values whenever they change —
  // same "adjust state during render" pattern as CoachSelect/SubstituteSelect.
  const [synced, setSynced] = useState(initial);
  if (
    synced.label !== initial.label ||
    synced.startTime !== initial.startTime ||
    synced.endTime !== initial.endTime ||
    synced.guestName !== initial.guestName
  ) {
    setSynced(initial);
    setFields(initial);
  }

  // Closing the dialog is a DOM API call, not React state, so it belongs in
  // an effect rather than the render-time resync above. Left open on error
  // so the admin can see what they typed and fix it.
  useEffect(() => {
    if (!state.error) dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Modifier ce cours (intitulé, horaires)"
        aria-label="Modifier ce cours"
        // Visible by default, same reasoning as ReviewButton/DeleteClassButton
        // — hidden until hover only applies once there's room for a full
        // week grid (see WeekGrid, whose event blocks carry the `group`
        // class this relies on at md+).
        className={`shrink-0 rounded-md p-1 text-base text-neutral-500 md:p-0 md:text-[10px] md:opacity-0 md:group-hover:opacity-100 ${light ? "hover:text-neutral-900" : "hover:text-white"}`}
      >
        ✎
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        onClose={() => setFields(initial)}
        className="w-72 rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-neutral-300 backdrop:bg-black/60"
      >
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={classInstanceId} />
          <h3 className="text-sm font-semibold text-white">Modifier le cours</h3>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Intitulé
            <input
              type="text"
              name="label"
              value={fields.label}
              onChange={(e) => setFields((f) => ({ ...f, label: e.target.value }))}
              required
              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-400">
              Début
              <input
                type="time"
                name="startTime"
                value={fields.startTime}
                onChange={(e) => setFields((f) => ({ ...f, startTime: e.target.value }))}
                required
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-400">
              Fin
              <input
                type="time"
                name="endTime"
                value={fields.endTime}
                onChange={(e) => setFields((f) => ({ ...f, endTime: e.target.value }))}
                required
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
              />
            </label>
          </div>
          {guestName !== undefined && (
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Coach invité
              <input
                type="text"
                name="guestName"
                value={fields.guestName}
                onChange={(e) => setFields((f) => ({ ...f, guestName: e.target.value }))}
                required
                maxLength={60}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
              />
              <span className="text-[10px] text-neutral-600">
                Renomme ce coach invité sur tous ses cours.
              </span>
              <button
                type="submit"
                formAction={removeGuestCoach}
                formNoValidate
                onClick={(e) => {
                  if (
                    !confirm(
                      `Retirer ${guestName} ? Ses cours non validés repasseront en « Non assigné ». Les cours déjà validés restent comptés.`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                className="self-start text-[11px] text-red-400 hover:text-red-300"
              >
                Retirer ce coach invité
              </button>
            </label>
          )}
          {state.error && <p className="text-xs text-red-400">{state.error}</p>}
          <p className="text-[10px] text-neutral-600">
            Ne modifie que ce cours — le modèle récurrent n&apos;est pas affecté.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
