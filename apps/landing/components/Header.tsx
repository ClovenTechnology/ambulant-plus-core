"use client";

import Link from "next/link";
import { ChevronDown, Mail, Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import Brand from "@/components/Brand";
import { groupedNav, utilityLinks } from "@/lib/routes";
import { site } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/82 backdrop-blur-2xl">
      <div className="hidden border-b border-slate-100 bg-slate-950 text-white xl:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-6 text-xs font-semibold">
          <div className="flex items-center gap-5">
            {utilityLinks.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-5 text-slate-200">
            <a href={site.phoneHref} className="inline-flex items-center gap-2 transition hover:text-white">
              <Phone className="h-3.5 w-3.5" />
              {site.phone}
            </a>
            <a href={`mailto:${site.supportEmail}`} className="inline-flex items-center gap-2 transition hover:text-white">
              <Mail className="h-3.5 w-3.5" />
              {site.supportEmail}
            </a>
            <a href={site.patientAppUrl} className="rounded-full bg-white px-4 py-1.5 text-slate-950 transition hover:bg-cyan-50">
              Access Patient App
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Ambulant+ home" className="focus-ring rounded-2xl">
          <Brand />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {groupedNav.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => setActiveGroup(group.label)}
              onMouseLeave={() => setActiveGroup(null)}
            >
              <Link
                href={group.href}
                className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-650 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 text-cyan-700" />
              </Link>

              {activeGroup === group.label && (
                <div className="absolute left-1/2 top-full z-50 w-[min(920px,calc(100vw-3rem))] -translate-x-1/2 pt-3">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl">
                    <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(group.columns.length, 4)}, minmax(0, 1fr))` }}>
                      {group.columns.map((column) => (
                        <div key={column.title}>
                          <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                            {column.title}
                          </div>
                          <div className="grid gap-2">
                            {column.links.map(({ label, href, icon: Icon }) => (
                              <Link
                                key={`${column.title}-${href}-${label}`}
                                href={href}
                                className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-slate-950"
                              >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 transition group-hover:bg-white">
                                  <Icon className="h-4 w-4" />
                                </span>
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/contact" className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-slate-650 transition hover:bg-slate-100 hover:text-slate-950">
            Contact
          </Link>
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
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-slate-100 bg-white/98 px-4 pb-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3 pt-4">
            {groupedNav.map((group) => (
              <details key={group.label} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-3">
                <summary className="cursor-pointer list-none px-2 py-2 text-sm font-bold text-slate-950">
                  {group.label}
                </summary>
                <div className="grid gap-4 px-2 pb-2 pt-3 sm:grid-cols-2">
                  {group.columns.map((column) => (
                    <div key={column.title}>
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                        {column.title}
                      </div>
                      <div className="grid gap-1">
                        {column.links.map(({ label, href }) => (
                          <Link
                            key={`${group.label}-${column.title}-${href}-${label}`}
                            href={href}
                            onClick={() => setOpen(false)}
                            className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}

            <Link href="/contact" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Contact
            </Link>

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
