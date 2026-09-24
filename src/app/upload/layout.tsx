import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma as basePrisma, tenantPrisma } from "@/lib/prisma";
import { coachLogout } from "@/lib/actions/auth";
import { requireCoachSession } from "@/lib/auth-context";

// Shared header + tab nav for the coach space — proxy.ts already gates
// every /upload/* route on a coach session, so this re-check (like the one
// each page under here still does for itself) is only a safety net for the
// narrow window described in requireCoachSession, plus what's needed here
// to render the org name.
export default async function UploadLayout({ children }: LayoutProps<"/upload">) {
  const session = await requireCoachSession();
  if (!session) redirect("/login");
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { archived: true } });
  if (!coach || coach.archived) redirect("/login");

  const organization = await basePrisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-sm font-semibold text-white">
            {organization?.name ?? "Crossfit Box"}
          </span>
          <nav className="flex items-center gap-4">
            <Link href="/upload" className="text-sm text-neutral-400 hover:text-white">
              Mes cours
            </Link>
            <Link href="/upload/reviews" className="text-sm text-neutral-400 hover:text-white">
              Mes reviews
            </Link>
          </nav>
          <form action={coachLogout} className="ml-auto">
            <button type="submit" className="text-sm text-neutral-400 hover:text-white">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
