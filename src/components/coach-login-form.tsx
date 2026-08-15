"use client";

import { useActionState } from "react";
import { coachLogin, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { error: null };

export function CoachLoginForm() {
  const [state, formAction, pending] = useActionState(coachLogin, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Name</label>
        <input
          type="text"
          name="name"
          required
          autoFocus
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-neutral-500">Password</label>
        <input
          type="password"
          name="password"
          required
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
