"use client";

import { platformDeleteAdmin } from "@/lib/actions/organizations";

export function DeleteAdminButton({
  adminId,
  organizationId,
  email,
}: {
  adminId: string;
  organizationId: string;
  email: string;
}) {
  return (
    <form
      action={platformDeleteAdmin}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer définitivement l'administrateur ${email} ? Cette action est irréversible et libère son email pour une autre box.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={adminId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        title="Supprimer cet administrateur"
        aria-label="Supprimer cet administrateur"
        className="rounded-md p-1 text-neutral-600 hover:text-red-400"
      >
        🗑
      </button>
    </form>
  );
}
