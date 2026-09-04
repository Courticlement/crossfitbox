import { cookies } from "next/headers";
import { Nav } from "@/components/nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { requireAdmin } from "@/lib/auth-context";
import { IMPERSONATOR_COOKIE } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const baseLinks = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/planning", label: "Planning" },
  { href: "/admin/coaches", label: "Coachs" },
  { href: "/admin/templates", label: "Modèles de cours" },
  { href: "/admin/rooms", label: "Salles" },
  { href: "/admin/data", label: "Données" },
  { href: "/admin/payments", label: "Paiements" },
  { href: "/admin/reviews", label: "Suivi coaching" },
  { href: "/upload", label: "Mes cours" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  // proxy.ts already blocks a plain ADMIN from /admin/admins — this only
  // controls whether the link itself is shown.
  const links =
    session?.role === "SUPERADMIN"
      ? [...baseLinks, { href: "/admin/admins", label: "Administrateurs" }]
      : baseLinks;

  // Presence of this cookie means the current admin_session belongs to a
  // PLATFORM_SUPERADMIN impersonating this box's admin (see
  // impersonateOrganization/stopImpersonating in
  // lib/actions/organizations.ts) — surfaced so it's never mistaken for a
  // real admin login.
  const isImpersonating = (await cookies()).has(IMPERSONATOR_COOKIE);
  const organization =
    isImpersonating && session?.organizationId
      ? await prisma.organization.findUnique({
          where: { id: session.organizationId },
          select: { name: true },
        })
      : null;

  return (
    <div className="flex flex-1 flex-col bg-neutral-950">
      {organization && <ImpersonationBanner organizationName={organization.name} />}
      <Nav links={links} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
