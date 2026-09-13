"use client";

import { deleteOrganization } from "@/lib/actions/organizations";

// Deleting a box wipes every coach, class, review and payment it ever had —
// far more destructive than any other delete in the app (see
// DeleteAdminButton for comparison) — so a plain confirm() isn't enough:
// the admin must type the box's exact name back, the same friction GitHub
// uses for repo deletion.
export function DeleteOrganizationButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteOrganization}
      onSubmit={(e) => {
        const typed = window.prompt(
          `Supprimer définitivement "${name}" ? Cela efface tous ses coachs, cours, avis et paiements — action irréversible. Tapez "${name}" pour confirmer.`
        );
        if (typed !== name) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60"
      >
        Supprimer cette organisation
      </button>
    </form>
  );
}
