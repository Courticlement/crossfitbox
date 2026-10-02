"use client";

import { useActionState, useRef, useState } from "react";
import { assignCoach, assignGuestCoach, type AssignCoachState } from "@/lib/actions/planning";

const initialState: AssignCoachState = { error: null };
// Sentinel <option> value that opens the guest-name field instead of
// submitting — see assignGuestCoach.
const NEW_GUEST = "__guest__";

export function CoachSelect({
  classInstanceId,
  coachId,
  coaches,
  templateCoachName,
}: {
  classInstanceId: string;
  coachId: string | null;
  coaches: { id: string; name: string; isGuest?: boolean; archived?: boolean }[];
  // Who the template's default coach is for this slot — purely informational,
  // shown alongside the select so the admin can see at a glance whether the
  // current assignment still matches the template or was overridden. Doesn't
  // constrain the select in any way; reassigning here never touches the
  // template itself.
  templateCoachName?: string | null;
}) {
  const [state, formAction] = useActionState(assignCoach, initialState);
  const [guestState, guestAction] = useActionState(assignGuestCoach, initialState);
  const [addingGuest, setAddingGuest] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(coachId ?? "");

  // Resyncs the dropdown to the server-confirmed coach whenever a change
  // round-trips: on success (revalidation updates the coachId prop) or on a
  // rejected change (state.error is set but coachId is unchanged, so this
  // snaps the select back to what's actually persisted).
  const [synced, setSynced] = useState({ coachId, state, guestState });
  if (synced.coachId !== coachId || synced.state !== state || synced.guestState !== guestState) {
    setSynced({ coachId, state, guestState });
    setValue(coachId ?? "");
    // Close the guest field once the guest is actually assigned; keep it
    // open on an error so the admin can fix the name.
    if (synced.coachId !== coachId) setAddingGuest(false);
  }
  const team = coaches.filter((c) => !c.isGuest);
  // A removed guest (archived, see removeGuestCoach) only stays listed on a
  // class they still teach, so the select can show it.
  const guests = coaches.filter((c) => c.isGuest && (!c.archived || c.id === coachId));
  const error = state.error ?? guestState.error;

  if (addingGuest) {
    return (
      <form action={guestAction} className="flex flex-col gap-0.5">
        <input type="hidden" name="id" value={classInstanceId} />
        <div className="flex gap-0.5">
          <input
            name="guestName"
            autoFocus
            required
            maxLength={60}
            placeholder="Nom du coach invité"
            className="w-full min-w-0 rounded border border-violet-400 bg-white px-1 py-0.5 text-[10px] text-neutral-900 focus:border-violet-600 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-violet-600 px-1 text-[10px] font-medium text-white hover:bg-violet-700"
          >
            OK
          </button>
          <button
            type="button"
            aria-label="Annuler"
            onClick={() => setAddingGuest(false)}
            className="rounded px-1 text-[10px] text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>
        {guestState.error && (
          <p title={guestState.error} className="truncate text-[9px] leading-tight text-red-600">
            ⚠ {guestState.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="id" value={classInstanceId} />
      <select
        name="coachId"
        value={value}
        onChange={(e) => {
          if (e.target.value === NEW_GUEST) {
            setAddingGuest(true);
            return;
          }
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        // Only ever rendered inside admin/planning's (light) WeekGrid/
        // DayAgenda — see coach-select.tsx's own header comment for why
        // this doesn't need a `light` prop like EditClassButton/
        // DeleteClassButton/ReviewButton/SubstituteSelect do.
        className={`w-full truncate rounded px-1 py-0.5 text-[10px] font-medium focus:outline-none ${
          value
            ? "border border-neutral-300 bg-white text-neutral-900 focus:border-neutral-500"
            : "border border-amber-400 bg-amber-100 text-amber-800 focus:border-amber-500"
        }`}
      >
        <option value="">Non assigné</option>
        {team.map((coach) => (
          <option key={coach.id} value={coach.id}>
            {coach.name}
          </option>
        ))}
        <optgroup label="Coachs invités">
          {guests.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name} (invité)
            </option>
          ))}
          <option value={NEW_GUEST}>+ Nouveau coach invité…</option>
        </optgroup>
      </select>
      {templateCoachName && (
        <p
          className={`truncate text-[9px] leading-tight ${
            coaches.find((c) => c.id === value)?.name === templateCoachName
              ? "text-neutral-500"
              : "text-amber-600"
          }`}
        >
          Modèle : {templateCoachName}
        </p>
      )}
      {error && (
        <p
          title={error}
          className="truncate text-[9px] leading-tight text-red-600"
        >
          ⚠ Coach occupé à cette heure
        </p>
      )}
    </form>
  );
}
