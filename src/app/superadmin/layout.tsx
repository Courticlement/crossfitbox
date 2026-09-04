import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { requireAdmin } from "@/lib/auth-context";

const links = [{ href: "/superadmin", label: "Organisations" }];

export default async function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  // proxy.ts already gates /superadmin to a PLATFORM_SUPERADMIN — this is
  // the same defensive re-check every layer in this app does (see
  // admin/layout.tsx, admins.ts's requireSuperadmin).
  const session = await requireAdmin();
  if (!session || session.organizationId !== null || session.role !== "PLATFORM_SUPERADMIN") {
    redirect("/admin-login");
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-950">
      <Nav links={links} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
