"use client";

import { useState } from "react";
import { setCoachPassword } from "@/lib/actions/coaches";

// Lets the admin set (or reset) a coach's /upload login password straight
// from their ID card — coaches can't self-register, so this is the only way
// they get credentials. The password field is left blank on every render
// (never pre-filled from a hash), so typing something and saving always sets
// a brand new password rather than looking like an editable existing one.
export function CoachPasswordForm({
  coachId,
  hasPassword,
  disabled = false,
}: {
  coachId: string;
  hasPassword: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-400">Login password</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          hasPassword ? "bg-emerald-900/40 text-emerald-300" : "bg-amber-900/40 text-amber-300"
        }`}
      >
        {hasPassword ? "Set" : "Not set"}
      </span>
      <form
        action={setCoachPassword}
        onSubmit={() => setValue("")}
        className="ml-auto flex items-center gap-1.5"
      >
        <input type="hidden" name="id" value={coachId} />
        <input
          type="password"
          name="password"
          placeholder="New password"
          minLength={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="w-28 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={disabled || value.length < 6}
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </form>
    </div>
  );
}
