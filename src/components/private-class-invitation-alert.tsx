import { acknowledgePrivateClassInvitation } from "@/lib/actions/private-class-invitations";
import type { PendingPrivateClassInvitation } from "@/lib/private-class-invitation-alerts";

// A coach's own view of the admin's nudge to log a private class — mirrors
// UnavailabilityAlert (admin Dashboard/Planning) in the other direction.
// Links straight down to PrivateClassForm's inline form (see its
// "private-class-form" id) rather than duplicating that form here.
export function PrivateClassInvitationAlert({
  invitations,
}: {
  invitations: PendingPrivateClassInvitation[];
}) {
  if (invitations.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
      <p className="mb-2 font-medium text-emerald-200">
        L&apos;admin vous invite à ajouter un cours privé
      </p>
      <ul className="flex flex-col gap-1.5">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-900/60 bg-emerald-950/40 px-2 py-1.5"
          >
            <a href="#private-class-form" className="text-emerald-100 underline hover:text-white">
              Ajouter un cours privé →
            </a>
            <form action={acknowledgePrivateClassInvitation}>
              <input type="hidden" name="id" value={invitation.id} />
              <button
                type="submit"
                className="shrink-0 text-xs text-emerald-200 underline hover:text-white"
              >
                Compris
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
