import Link from "next/link";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { createOrganization, impersonateOrganization } from "@/lib/actions/organizations";
import { RoomNamesInput } from "@/components/room-names-input";
import { formatDateISO } from "@/lib/dates";

// Without this, Next would statically prerender the page and freeze the
// organization list until the next deploy — same reasoning as every other
// admin list page (see /admin/coaches, /admin/admins).
export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  const organizationsBase = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { admins: true } } },
  });

  // Coach/Room live in each organization's own Postgres schema (see
  // tenantPrisma in lib/prisma.ts) — unlike admins, their counts can't come
  // from a single cross-schema Prisma _count, so each org gets its own pair
  // of queries. Fine at "a handful of organizations" scale; would need
  // batching if this ever needs to list hundreds.
  const organizations = await Promise.all(
    organizationsBase.map(async (org) => {
      const db = tenantPrisma(org.id);
      const [coachCount, roomCount] = await Promise.all([db.coach.count(), db.room.count()]);
      return { ...org, coachCount, roomCount };
    })
  );

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Organisations</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Chaque organisation est une box CrossFit indépendante, avec ses propres coachs, salles et
        planning.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="text-base font-semibold text-white">{org.name}</div>
              <Link
                href={`/superadmin/organizations/${org.id}`}
                className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
              >
                Modifier
              </Link>
            </div>
            <div className="text-xs text-neutral-500">Créée le {formatDateISO(org.createdAt)}</div>
            <div className="mt-3 flex gap-3 text-xs text-neutral-400">
              <span>{org._count.admins} admin(s)</span>
              <span>{org.coachCount} coach(s)</span>
              <span>{org.roomCount} salle(s)</span>
            </div>
            {org._count.admins > 0 && (
              <form action={impersonateOrganization} className="mt-3">
                <input type="hidden" name="organizationId" value={org.id} />
                <button
                  type="submit"
                  className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
                >
                  Se connecter en tant qu&apos;admin
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Créer une organisation</h2>
        <form action={createOrganization} className="flex flex-col gap-3">
          <div>
            <span className="mb-1 block text-xs text-neutral-500">Nom de la box</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Nom de la box"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <RoomNamesInput />

          <div className="mt-1 border-t border-neutral-800 pt-3">
            <span className="mb-1 block text-xs text-neutral-500">Premier administrateur</span>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                name="adminEmail"
                required
                placeholder="Email"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
              <input
                type="password"
                name="adminPassword"
                required
                minLength={6}
                placeholder="Mot de passe temporaire"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Créer l&apos;organisation
          </button>
        </form>
      </div>
    </div>
  );
}
