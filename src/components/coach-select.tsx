"use client";

import { useActionState, useRef, useState } from "react";
import { assignCoach, type AssignCoachState } from "@/lib/actions/planning";

const initialState: AssignCoachState = { error: null };

export function CoachSelect({
  classInstanceId,
  coachId,
  coaches,
  templateCoachName,
}: {
  classInstanceId: string;
  coachId: string | null;
  coaches: { id: string; name: string }[];
  // Who the template's default coach is for this slot — purely informational,
  // shown alongside the select so the admin can see at a glance whether the
  // current assignment still matches the template or was overridden. Doesn't
  // constrain the select in any way; reassigning here never touches the
  // template itself.
  templateCoachName?: string | null;
}) {
  const [state, formAction] = useActionState(assignCoach, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(coachId ?? "");

  // Resyncs the dropdown to the server-confirmed coach whenever a change
  // round-trips: on success (revalidation updates the coachId prop) or on a
  // rejected change (state.error is set but coachId is unchanged, so this
  // snaps the select back to what's actually persisted).
  const [synced, setSynced] = useState({ coachId, state });
  if (synced.coachId !== coachId || synced.state !== state) {
    setSynced({ coachId, state });
    setValue(coachId ?? "");
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="id" value={classInstanceId} />
      <select
        name="coachId"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        className={`w-full truncate rounded px-1 py-0.5 text-[10px] font-medium focus:outline-none ${
          value
            ? "border border-neutral-700 bg-neutral-950 text-white focus:border-neutral-500"
            : "border border-amber-700/70 bg-amber-950/30 text-amber-300 focus:border-amber-500"
        }`}
      >
        <option value="">Non assigné</option>
        {coaches.map((coach) => (
          <option key={coach.id} value={coach.id}>
            {coach.name}
          </option>
        ))}
      </select>
      {templateCoachName && (
        <p
          className={`truncate text-[9px] leading-tight ${
            coaches.find((c) => c.id === value)?.name === templateCoachName
              ? "text-neutral-500"
              : "text-amber-400"
          }`}
        >
          Modèle : {templateCoachName}
        </p>
      )}
      {state.error && (
        <p
          title={state.error}
          className="truncate text-[9px] leading-tight text-red-400"
        >
          ⚠ Coach occupé à cette heure
        </p>
      )}
    </form>
  );
}
