// apps/patient-app/src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavItem } from "@ambulant/ui-shell";

export default function Sidebar({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(o => !o);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${open ? "opacity-60 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
        style={{ background: "rgba(0,0,0,0.55)" }}
      />

      {/* Drawer */}
      <aside
        aria-hidden={!open}
        aria-label="Main navigation"
        className={`fixed left-0 top-0 z-50 h-full w-72 max-w-full transform bg-white border-r ${open ? "translate-x-0" : "-translate-x-full"} transition-transform duration-200 shadow-lg`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold text-lg">Ambulant+</div>
          <button
            aria-label="Close menu"
            className="px-2 py-1 rounded hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {items.map((it) => (
            <Link key={it.href} href={it.href}>
              <a
                className="block rounded px-3 py-2 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                onClick={() => setOpen(false)}
              >
                {it.label}
              </a>
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t text-sm text-gray-500">
          © {new Date().getFullYear()} Cloven Technology
        </div>
      </aside>

      {/* Desktop persistent sidebar (optional) */}
      <aside className="hidden md:fixed md:left-0 md:top-0 md:z-30 md:h-full md:w-64 md:flex md:flex-col md:border-r md:bg-white md:shadow-sm md:pt-4">
        <div className="p-4 font-semibold text-lg">Ambulant+</div>
        <nav className="p-4 space-y-1">
          {items.map(it => (
            <Link key={it.href} href={it.href}>
              <a className="block rounded px-3 py-2 hover:bg-gray-50">{it.label}</a>
            </Link>
          ))}
        </nav>
      </aside>

      {/* adjust page content spacing when desktop sidebar present */}
      <style jsx global>{`
        @media (min-width: 768px) {
          main#main-content { margin-left: 16rem; } /* matches md:w-64 + gap */
        }
      `}</style>
    </>
  );
}
