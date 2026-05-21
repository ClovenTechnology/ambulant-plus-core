// apps/patient-app/app/allergies/page.tsx
'use client';

import Link from 'next/link';
import { FileText, Printer, ShieldAlert } from 'lucide-react';
import AllergiesClient from './allergies-client';

export const dynamic = 'force-dynamic';

export default function AllergiesPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/88 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(6,182,212,0.14),transparent_34%),radial-gradient(circle_at_100%_12%,rgba(244,63,94,0.08),transparent_28%)]" />

          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800">
                <ShieldAlert className="h-3.5 w-3.5" />
                Safety profile
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Allergies & reactions
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Keep your known allergy profile accurate and record reaction events over time. This supports safer prescribing, better clinical handover, and clearer printed summaries for care teams.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/allergies/print"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Print summary
              </Link>
              <Link
                href="/reports"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800"
              >
                <FileText className="h-4 w-4" />
                Reports
              </Link>
            </div>
          </div>
        </header>

        <AllergiesClient />
      </div>
    </main>
  );
}
