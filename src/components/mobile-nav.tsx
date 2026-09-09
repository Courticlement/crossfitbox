"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/nav";

// The same admin nav links, collapsed behind a burger button below the md
// breakpoint — see Nav, which renders the full horizontal list instead once
// there's room for it. A grouped item (see NavDropdown on desktop) renders
// here as a plain labeled section instead of a dropdown — a burger menu
// already has the vertical room a dropdown is meant to save.
export function MobileNav({ links }: { links: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-900 hover:text-white"
      >
        {open ? (
          <span className="text-lg leading-none">✕</span>
        ) : (
          <span className="flex flex-col gap-[3px]">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 py-1.5 shadow-xl">
            {links.map((link) =>
              "items" in link ? (
                <div key={link.label}>
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-neutral-600 uppercase">
                    {link.label}
                  </div>
                  {link.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block px-6 py-2.5 text-sm ${
                          active ? "font-medium text-white" : "text-neutral-400"
                        } hover:bg-neutral-900 hover:text-white`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 text-sm ${
                    pathname === link.href ? "font-medium text-white" : "text-neutral-400"
                  } hover:bg-neutral-900 hover:text-white`}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </>
      )}
    </div>
  );
}
