"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A grouped entry in the desktop Nav (e.g. "Staff" bundling Coachs/Salles/
// Paiements) — MobileNav renders the same group as a plain indented section
// instead, since a burger menu already has the vertical room a dropdown is
// meant to save.
export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((item) => item.href === pathname);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1 text-sm ${
          active ? "text-white" : "text-neutral-400"
        } hover:text-white`}
      >
        {label}
        <span className={`text-[10px] transition-transform ${open ? "-rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <nav className="absolute left-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 py-1.5 shadow-xl">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm ${
                  isActive ? "font-medium text-white" : "text-neutral-400"
                } hover:bg-neutral-900 hover:text-white`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
