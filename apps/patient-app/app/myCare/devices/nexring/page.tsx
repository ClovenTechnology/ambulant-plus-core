// apps/patient-app/app/myCare/devices/nexring/page.tsx
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import NexRingPanel from '@/components/NexRingPanel';

export default function NexRingPage() {
  return (
    <main
      data-p-ui="patient-nexring-page"
      className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip px-3 py-4 sm:px-4 md:px-5 md:py-5"
    >
      <header className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
            <ShieldCheck className="h-4 w-4" />
            Connected wearable
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            NexRing
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Connect your ring, sync wellness and activity history, and review the
            ring-derived trends available to your Ambulant+ care record.
          </p>
        </div>

        <Link
          href="/iomt"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Devices
        </Link>
      </header>

      <NexRingPanel />
    </main>
  );
}
