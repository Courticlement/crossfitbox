"use client";

import { useActionState, useRef, useState } from "react";
import { assignSubstitute, type AssignCoachState } from "@/lib/actions/planning";

const initialState: AssignCoachState = { error: null };

export function SubstituteSelect({
  classInstanceId,
  coachId,
  substituteCoachId,
  coaches,
  adminContext = false,
  locked = false,
}: {
  classInstanceId: string;
  coachId: string | null;
  substituteCoachId: string | null;
  coaches: { id: string; name: string }[];
  // Set on the admin's Planning page usage so this bypasses the
  // validated-week lock that otherwise applies to the coach-facing My
  // Classes usage (see assignSubstitute).
  adminContext?: boolean;
  locked?: boolean;
}) {
  const [state, formAction] = useActionState(assignSubstitute, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(substituteCoachId ?? "");

  // Resyncs the dropdown to the server-confirmed substitute whenever a
  // change round-trips — see CoachSelect for why this happens during render
  // rather than in an effect.
  const [synced, setSynced] = useState({ substituteCoachId, state });
  if (synced.substituteCoachId !== substituteCoachId || synced.state !== state) {
    setSynced({ substituteCoachId, state });
    setValue(substituteCoachId ?? "");
  }

  const options = coaches.filter((c) => c.id !== coachId);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="id" value={classInstanceId} />
      {adminContext && <input type="hidden" name="context" value="admin" />}
      <select
        name="substituteCoachId"
        value={value}
        disabled={locked}
        onChange={(e) => {
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        className="w-full truncate rounded border border-amber-800 bg-neutral-950 px-1 py-0.5 text-[10px] text-amber-300 focus:border-amber-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">No substitute</option>
        {options.map((coach) => (
          <option key={coach.id} value={coach.id}>
            Covered by {coach.name}
          </option>
        ))}
      </select>
      {state.error && (
        <p
          title={state.error}
          className="truncate text-[9px] leading-tight text-red-400"
        >
          ⚠ Coach busy at this time
        </p>
      )}
    </form>
  );
}
