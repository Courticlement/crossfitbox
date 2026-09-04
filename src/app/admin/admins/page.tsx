import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth-context";
import { createAdmin, archiveAdmin, unarchiveAdmin } from "@/lib/actions/admins";
import { AdminPasswordForm } from "@/components/admin-password-form";
import { AdminRoleForm } from "@/components/admin-role-form";
import { formatDateISO } from "@/lib/dates";

// Same reasoning as /admin/coaches: without this, Next would statically
// prerender the page and freeze the admin list until the next deploy.
export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  email: string;
  role: string;
  archived: boolean;
  createdAt: Date;
};

function AdminCard({ admin, currentAdminId }: { admin: AdminRow; currentAdminId: string }) {
  const isSelf = admin.id === currentAdminId;

  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        admin.archived
          ? "border-neutral-800 bg-neutral-900/50 opacity-70"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            {admin.email}
            {isSelf && (
              <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                Vous
              </span>
            )}
            {admin.archived && (
              <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                Archivé
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            Créé le {formatDateISO(admin.createdAt)}
          </div>
        </div>
        {!isSelf && (
          <div className="flex shrink-0 items-center gap-1.5">
            {admin.archived ? (
              <form action={unarchiveAdmin}>
                <input type="hidden" name="id" value={admin.id} />
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
                >
                  Désarchiver
                </button>
              </form>
            ) : (
              <form action={archiveAdmin}>
                <input type="hidden" name="id" value={admin.id} />
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
                >
                  Archiver
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-400">Rôle</span>
        <AdminRoleForm adminId={admin.id} role={admin.role} disabled={admin.archived} />
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-2.5">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          Accès
        </h3>
        <AdminPasswordForm adminId={admin.id} disabled={admin.archived} />
      </div>
    </div>
  );
}

export default async function AdminsPage() {
  const session = await requireOrgAdmin();
  const admins = await prisma.admin.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ archived: "asc" }, { email: "asc" }],
  });

  const activeAdmins = admins.filter((a) => !a.archived);
  const archivedAdmins = admins.filter((a) => a.archived);

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Administrateurs</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Gère qui peut se connecter à l&apos;espace admin, et avec quel rôle. Seul un superadmin
        voit cette page.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeAdmins.map((admin) => (
          <AdminCard key={admin.id} admin={admin} currentAdminId={session.adminId} />
        ))}
      </div>

      {archivedAdmins.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Archivés ({archivedAdmins.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archivedAdmins.map((admin) => (
              <AdminCard key={admin.id} admin={admin} currentAdminId={session.adminId} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Ajouter un administrateur</h2>
        <form action={createAdmin} className="flex flex-col gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <input
            type="password"
            name="password"
            required
            minLength={6}
            placeholder="Mot de passe"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <div>
            <span className="mb-1 block text-xs text-neutral-500">Rôle</span>
            <select
              name="role"
              defaultValue="ADMIN"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="ADMIN">Admin</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Ajouter l&apos;administrateur
          </button>
        </form>
      </div>
    </div>
  );
}
