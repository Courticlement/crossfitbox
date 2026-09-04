import { stopImpersonating } from "@/lib/actions/organizations";

// Shown across every /admin page whenever the current admin_session is
// actually a PLATFORM_SUPERADMIN impersonating this box's admin (see
// impersonateOrganization) — without this, there'd be no visible sign that
// this isn't a real login for the box's own admin, and no way back to
// /superadmin short of knowing to hit stopImpersonating directly.
export function ImpersonationBanner({ organizationName }: { organizationName: string }) {
  return (
    <div className="border-b border-amber-800 bg-amber-950/60 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs">
        <span className="text-amber-200">
          Connecté en tant qu&apos;admin de <strong>{organizationName}</strong> (vue superadmin)
        </span>
        <form action={stopImpersonating}>
          <button type="submit" className="font-medium text-amber-100 underline hover:text-white">
            Retour au superadmin
          </button>
        </form>
      </div>
    </div>
  );
}
