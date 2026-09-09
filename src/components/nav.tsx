import Link from "next/link";
import { adminLogout } from "@/lib/actions/auth";
import { MobileNav } from "@/components/mobile-nav";
import { NavDropdown } from "@/components/nav-dropdown";

// A plain link, or a labeled group of them collapsed behind a dropdown on
// desktop (see NavDropdown) — e.g. "Staff" bundling Coachs/Salles/Paiements
// so the top bar doesn't grow a link per admin sub-page.
export type NavItem =
  | { href: string; label: string }
  | { label: string; items: { href: string; label: string }[] };

export function Nav({ links }: { links: NavItem[] }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-3">
        <span className="mr-6 text-sm font-semibold text-white">
          Crossfit Box
        </span>
        <nav className="hidden flex-1 items-center gap-4 md:flex">
          {links.map((link) =>
            "items" in link ? (
              <NavDropdown key={link.label} label={link.label} items={link.items} />
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-neutral-400 hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <form action={adminLogout}>
            <button type="submit" className="text-sm text-neutral-400 hover:text-white">
              Se déconnecter
            </button>
          </form>
          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}
