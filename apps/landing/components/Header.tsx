"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Mail, Menu, Phone, X } from "lucide-react";
import { useRef, useState } from "react";
import Brand from "@/components/Brand";
import { groupedNav, utilityLinks } from "@/lib/routes";
import { site } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openGroup(label: string) {
    cancelClose();
    setActiveGroup(label);
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setActiveGroup(null);
    }, 160);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-100/70 bg-white/96 shadow-sm shadow-cyan-950/5 backdrop-blur-2xl">
      <div className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-3 px-4 text-[11px] font-semibold md:px-6 lg:h-10 lg:text-xs">
          <div className="flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-none lg:gap-5">
            <Link href="/patients" className="inline-flex items-center gap-1.5 text-slate-200 transition hover:text-white">
              Patients
            </Link>
            <Link href="/clinicians" className="inline-flex items-center gap-1.5 text-slate-200 transition hover:text-white">
              Clinicians
            </Link>
            <Link href="/clients" className="inline-flex items-center gap-1.5 text-slate-200 transition hover:text-white">
              Clients
            </Link>

            <div className="hidden items-center gap-5 lg:flex">
              {utilityLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 whitespace-nowrap text-slate-200 transition hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-slate-200 lg:gap-5">
            <a
              href={site.phoneHref}
              className="inline-flex items-center gap-1.5 transition hover:text-white lg:gap-2"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{site.phone}</span>
              <span className="sm:hidden">Call</span>
            </a>

            <a
              href={`mailto:${site.supportEmail}`}
              className="hidden items-center gap-2 transition hover:text-white lg:inline-flex"
            >
              <Mail className="h-3.5 w-3.5" />
              {site.supportEmail}
            </a>

            <a
              href={site.patientAppUrl}
              className="hidden rounded-full bg-white px-4 py-1.5 text-slate-950 transition hover:bg-cyan-50 lg:inline-flex"
            >
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
              onMouseEnter={() => openGroup(group.label)}
              onMouseLeave={scheduleClose}
              onFocus={() => openGroup(group.label)}
            >
              <Link
                href={group.href}
                className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-slate-950"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 text-cyan-700" />
              </Link>

              {activeGroup === group.label && (
                <div
                  className="fixed left-1/2 top-[116px] z-[80] w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 pt-4"
                  onMouseEnter={() => openGroup(group.label)}
                  onMouseLeave={scheduleClose}
                >
                  <div className="relative overflow-hidden rounded-[34px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/95 to-indigo-50/95 p-5 shadow-2xl shadow-slate-950/24 ring-1 ring-cyan-100 backdrop-blur-2xl">
                    <div className="pointer-events-none absolute -left-24 top-0 h-56 w-56 rounded-full bg-cyan-300/18 blur-3xl" />
                    <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-indigo-300/18 blur-3xl" />

                    <div
                      className="relative grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(
                          group.columns.length,
                          4,
                        )}, minmax(0, 1fr))`,
                      }}
                    >
                      {group.columns.map((column) => (
                        <div
                          key={column.title}
                          className="rounded-[26px] border border-cyan-100 bg-white/98 p-4 shadow-sm shadow-cyan-950/10"
                        >
                          <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
                            {column.title}
                          </div>

                          <div className="grid gap-2">
                            {column.links.map(({ label, href, icon: Icon }) => (
                              <Link
                                key={`${column.title}-${href}-${label}`}
                                href={href}
                                className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-950 hover:text-white"
                                onClick={() => setActiveGroup(null)}
                              >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 transition group-hover:bg-white/10 group-hover:text-cyan-100">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 truncate">{label}</span>
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

          <Link
            href="/contact"
            className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-slate-950"
          >
            Contact
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={site.patientAppUrl}
            className="focus-ring rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            Patient App
          </a>

          <a
            href={site.clinicianAppUrl}
            className="focus-ring rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
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
        <div className="max-h-[calc(100vh-7.25rem)] overflow-y-auto border-t border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 px-4 pb-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3 pt-4">
            {groupedNav.map((group) => (
              <details
                key={group.label}
                className="group rounded-3xl border border-cyan-100 bg-white/98 p-3 shadow-sm shadow-cyan-950/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-2 py-2 text-sm font-bold text-slate-950">
                  <span>{group.label}</span>
                  <ChevronRight className="h-4 w-4 text-cyan-700 transition group-open:rotate-90" />
                </summary>

                <div className="grid gap-4 px-2 pb-2 pt-3 sm:grid-cols-2">
                  {group.columns.map((column) => (
                    <div
                      key={column.title}
                      className="rounded-2xl border border-cyan-50 bg-white p-3 shadow-sm shadow-cyan-950/5"
                    >
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                        {column.title}
                      </div>

                      <div className="grid gap-1">
                        {column.links.map(({ label, href }) => (
                          <Link
                            key={`${group.label}-${column.title}-${href}-${label}`}
                            href={href}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-cyan-50"
                          >
                            <span>{label}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-cyan-700" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}

            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span>Contact</span>
              <ChevronRight className="h-4 w-4 text-cyan-700" />
            </Link>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <a
                href={site.patientAppUrl}
                className="rounded-2xl bg-cyan-50 px-4 py-3 text-center text-sm font-semibold text-cyan-800"
              >
                Patient App
              </a>

              <a
                href={site.clinicianAppUrl}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Clinician Login
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}