import { invitePrivateClass } from "@/lib/actions/private-class-invitations";

// Sits next to the PDF export button on the Dashboard tab (week and month
// views) — lets the admin pick several coaches at once and nudge each to
// log a private class from their own My Classes page. Coaches with zero
// private classes this period (see withoutPrivateClassIds, sourced from the
// same "Privés" column already on the table above) come pre-checked, so the
// common case — invite everyone who hasn't logged one yet — is just
// opening this and hitting the button. A plain <details> disclosure with
// native checkboxes, same as CalendarSyncCard/UnavailabilityForm elsewhere
// on this app — no client JS needed. The invitation itself shows up on
// each coach's own page as a dismissible banner (see
// PrivateClassInvitationAlert); this form never touches ClassInstance,
// it's purely a notification.
export function InvitePrivateClassForm({
  coaches,
  withoutPrivateClassIds,
}: {
  coaches: { id: string; name: string; archived: boolean }[];
  withoutPrivateClassIds: Set<string>;
}) {
  const activeCoaches = coaches.filter((c) => !c.archived);
  if (activeCoaches.length === 0) return null;

  return (
    <details className="rounded-md border border-neutral-700 bg-neutral-950">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-300 hover:text-white">
        Inviter à ajouter un cours privé
      </summary>
      <form action={invitePrivateClass} className="flex flex-col gap-3 border-t border-neutral-800 p-3">
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {activeCoaches.map((coach) => (
            <label key={coach.id} className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                name="coachId"
                value={coach.id}
                defaultChecked={withoutPrivateClassIds.has(coach.id)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 accent-emerald-500"
              />
              {coach.name}
              {withoutPrivateClassIds.has(coach.id) && (
                <span className="text-xs text-amber-400">— aucun cours privé</span>
              )}
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="self-start rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Inviter
        </button>
      </form>
    </details>
  );
}
