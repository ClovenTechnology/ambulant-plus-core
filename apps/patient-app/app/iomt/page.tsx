import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import IoMTPane from '@/components/iomt/Pane';

const DEVICE_CHIPS = [
  'Health Monitor',
  'Stethoscope',
  'Otoscope',
  'NexRing',
];

export default function IoMTPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur">
            <Cpu className="h-3.5 w-3.5" />
            Advanced Device Console
          </div>

          <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-2xl">
            Unified IoMT quick console for device switching, testing, and live operational access.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            Use this page for rapid movement between Health Monitor, Digital Stethoscope,
            HD Otoscope, and NexRing. The cleaner patient-facing entry point remains{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-100">/devices</code>.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {DEVICE_CHIPS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-slate-200 backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/devices"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:-translate-y-0.5"
            >
              Open Devices Hub
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/devices/setup/health-monitor"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
            >
              Setup Guides
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <IoMTPane />
    </main>
  );
}