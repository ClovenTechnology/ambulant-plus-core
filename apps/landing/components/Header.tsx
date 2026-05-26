"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import Brand from "@/components/Brand";
import { navLinks } from "@/lib/routes";
import { site } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/78 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Ambulant+ home" className="focus-ring rounded-2xl">
          <Brand />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={site.patientAppUrl}
            className="focus-ring rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800"
          >
            Patient App
          </a>
          <a
            href={site.clinicianAppUrl}
            className="focus-ring rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Clinician Login
          </a>
        </div>

        <button
          className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open navigation menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white/95 px-4 pb-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2 pt-4">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <a href={site.patientAppUrl} className="rounded-2xl bg-cyan-50 px-4 py-3 text-center text-sm font-semibold text-cyan-800">
                Patient App
              </a>
              <a href={site.clinicianAppUrl} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">
                Clinician Login
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
