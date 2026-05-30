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
    <header className="sticky top-0 z-50 border-b border-cyan-100/60 bg-white/84 shadow-sm shadow-cyan-950/5 backdrop-blur-2xl">
      <div className="hidden border-b border-white/10 bg-slate-950 text-white lg:block">
        <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-between gap-5 px-4 py-2 text-xs font-semibold md:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            {utilityLinks.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-4 text-slate-200">
            <a href={site.phoneHref} className="hidden items-center gap-2 transition hover:text-white xl:inline-flex">
              <Phone className="h-3.5 w-3.5" />
              {site.phone}
            </a>
            <a href={`mailto:${site.supportEmail}`} className="hidden items-center gap-2 transition hover:text-white 2xl:inline-flex">
              <Mail className="h-3.5 w-3.5" />
              {site.supportEmail}
            </a>
            <a href={site.patientAppUrl} className="rounded-full bg-white px-4 py-1.5 text-slate-950 shadow-sm transition hover:bg-cyan-50">
              Access Patient App
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label="Ambulant+ home" className="focus-ring min-w-0 rounded-2xl">
          <Brand />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {groupedNav.map((group) => (
            <div key={group.label} className="relative" onMouseEnter={() => setActiveGroup(group.label)} onMouseLeave={() => setActiveGroup(null)}>
              <Link href={group.href} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-650 transition hover:bg-cyan-50 hover:text-slate-950">
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 text-cyan-700" />
              </Link>

              {activeGroup === group.label && (
                <div className="absolute left-1/2 top-full z-50 w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 pt-4">
                  <div className="relative overflow-hidden rounded-[32px] border border-cyan-100/80 bg-gradient-to-br from-white/96 via-cyan-50/92 to-indigo-50/82 p-5 shadow-2xl shadow-cyan-950/15 backdrop-blur-2xl">
                    <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
                    <div className="pointer-events-none absolute -right-28 bottom-0 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />
                    <div className="relative grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(group.columns.length, 4)}, minmax(0, 1fr))` }}>
                      {group.columns.map((column) => (
                        <div key={column.title} className="rounded-3xl border border-white/70 bg-white/68 p-4 shadow-sm backdrop-blur-xl">
                          <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">{column.title}</div>
                          <div className="grid gap-2">
                            {column.links.map(({ label, href, icon: Icon }) => (
                              <Link key={`${column.title}-${href}-${label}`} href={href} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-950 hover:text-white">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 transition group-hover:bg-white group-hover:text-cyan-700">
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
          <Link href="/contact" className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-slate-650 transition hover:bg-cyan-50 hover:text-slate-950">Contact</Link>
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <a href={site.patientAppUrl} className="focus-ring rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5 hover:bg-white">Patient App</a>
          <a href={site.clinicianAppUrl} className="focus-ring rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5">Clinician Login</a>
        </div>

        <button className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Open navigation menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-cyan-100 bg-gradient-to-br from-white via-cyan-50/80 to-indigo-50/70 px-4 pb-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3 pt-4">
            {groupedNav.map((group) => (
              <details key={group.label} className="rounded-3xl border border-white/80 bg-white/78 p-3 shadow-sm backdrop-blur-xl">
                <summary className="cursor-pointer list-none px-2 py-2 text-sm font-bold text-slate-950">{group.label}</summary>
                <div className="grid gap-4 px-2 pb-2 pt-3 sm:grid-cols-2">
                  {group.columns.map((column) => (
                    <div key={column.title}>
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{column.title}</div>
                      <div className="grid gap-1">
                        {column.links.map(({ label, href }) => (
                          <Link key={`${group.label}-${column.title}-${href}-${label}`} href={href} onClick={() => setOpen(false)} className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-cyan-50">{label}</Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            <Link href="/contact" onClick={() => setOpen(false)} className="rounded-2xl bg-white/78 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50">Contact</Link>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <a href={site.patientAppUrl} className="rounded-2xl bg-cyan-50 px-4 py-3 text-center text-sm font-semibold text-cyan-800">Patient App</a>
              <a href={site.clinicianAppUrl} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">Clinician Login</a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
