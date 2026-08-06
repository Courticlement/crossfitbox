import { Nav } from "@/components/nav";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/planning", label: "Planning" },
  { href: "/admin/coaches", label: "Coaches" },
  { href: "/admin/templates", label: "Class Templates" },
  { href: "/upload", label: "My Classes" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <Nav links={links} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
