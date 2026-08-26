import Link from "next/link";
import { adminLogout } from "@/lib/actions/auth";

export function Nav({ links }: { links: { href: string; label: string }[] }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-3">
        <span className="mr-6 text-sm font-semibold text-white">
          Crossfit Box
        </span>
        <nav className="flex flex-1 gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-400 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={adminLogout}>
          <button type="submit" className="text-sm text-neutral-400 hover:text-white">
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
