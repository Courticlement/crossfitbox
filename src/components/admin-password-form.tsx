"use client";

import { useState } from "react";
import { setAdminPassword } from "@/lib/actions/admins";

// Mirrors CoachPasswordForm — the password field is always blank on render
// so typing something and saving always sets a brand new password rather
// than looking like an editable existing one.
export function AdminPasswordForm({
  adminId,
  disabled = false,
}: {
  adminId: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      action={setAdminPassword}
      onSubmit={() => setValue("")}
      className="flex items-center gap-1.5"
    >
      <input type="hidden" name="id" value={adminId} />
      <span className="text-xs font-medium text-neutral-400">Nouveau mot de passe</span>
      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        minLength={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="ml-auto w-28 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || value.length < 6}
        className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Enregistrer
      </button>
    </form>
  );
}
