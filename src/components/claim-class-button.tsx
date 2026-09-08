"use client";

import { useActionState } from "react";
import { claimClass, type ClaimState } from "@/lib/actions/claims";

const initialState: ClaimState = { error: null };

export function ClaimClassButton({
  classInstanceId,
  locked,
}: {
  classInstanceId: string;
  locked: boolean;
}) {
  const [state, formAction] = useActionState(claimClass, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="classInstanceId" value={classInstanceId} />
      <button
        type="submit"
        disabled={locked}
        className="rounded bg-sky-500 px-1.5 py-0.5 text-left text-[10px] font-bold text-neutral-950 shadow-sm shadow-sky-500/40 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-500/40 disabled:text-neutral-950/60 disabled:shadow-none"
      >
        Réclamer ce cours
      </button>
      {state.error && (
        <p className="truncate text-[9px] leading-tight text-red-400" title={state.error}>
          {state.error}
        </p>
      )}
    </form>
  );
}
