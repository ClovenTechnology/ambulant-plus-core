// apps/patient-app/components/HeaderNav.tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Calendar, ClipboardList, Home, ShieldCheck, Stethoscope } from 'lucide-react';
import { useActiveEncounter } from './context/ActiveEncounterContext';

export default function HeaderNav() {
  const { activeEncounter } = useActiveEncounter();

  return (
    <header className="border-b border-slate-200/80 bg-white/85 px-6 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-2" aria-label="Quick navigation">
          <QuickLink href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <QuickLink href="/appointments" label="Appointments" icon={<Calendar className="h-4 w-4" />} />
          <QuickLink href="/clinicians" label="Clinicians" icon={<Stethoscope className="h-4 w-4" />} />
          <QuickLink href="/encounters" label="Encounters" icon={<ClipboardList className="h-4 w-4" />} />
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Patient workspace active
          </div>

          {activeEncounter ? (
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              Active encounter:{' '}
              <span className="font-bold text-slate-900">{activeEncounter.id}</span>
            </div>
          ) : (
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              No active encounter
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
    >
      {icon}
      {label}
    </Link>
  );
}
