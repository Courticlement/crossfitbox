import { Nav } from "@/components/nav";

const links = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/planning", label: "Planning" },
  { href: "/admin/coaches", label: "Coachs" },
  { href: "/admin/templates", label: "Modèles de cours" },
  { href: "/admin/data", label: "Données" },
  { href: "/upload", label: "Mes cours" },
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
