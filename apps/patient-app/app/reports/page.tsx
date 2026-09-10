'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Download,
  HeartPulse,
  Moon,
  Share2,
  Sparkles,
  Thermometer,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

type VitalsReport = {
  ok?: boolean;
  generatedAtISO?: string;
  latest?: {
    ts?: string | null;
    hr?: number | null;
    spo2?: number | null;
    temp_c?: number | null;
    sys?: number | null;
    dia?: number | null;
    glucose?: number | null;
    rr?: number | null;
    steps?: number | null;
  } | null;
};

const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

const REPORTS = [
  {
    href: '/reports/vitals',
    title: 'Vitals',
    desc: 'Persisted blood pressure, heart rate, oxygen saturation, temperature and other direct observations.',
    icon: HeartPulse,
  },
  {
    href: '/reports/sleep',
    title: 'Sleep',
    desc: 'Persisted sleep-stage and duration observations without synthetic quality or readiness scores.',
    icon: Moon,
  },
  {
    href: '/reports/stress',
    title: 'Stress',
    desc: 'Direct persisted stress observations. No score is inferred from activity, sleep or heart-rate signals.',
    icon: Activity,
  },
  {
    href: '/reports/fertility',
    title: 'Reproductive health',
    desc: 'Persisted observations only. No cycle-phase, ovulation or pregnancy inference from wearable physiology.',
    icon: Sparkles,
  },
] as const;

function fmt(value: number | null | undefined, digits = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
    : '—';
}

export default function ReportsHub() {
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyExport, setBusyExport] = useState(false);
  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      setDiscreet((localStorage.getItem(LS_DISCREET) || '0') === '1');
      setHideSensitive((localStorage.getItem(LS_HIDE_SENSITIVE) || '0') === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DISCREET, discreet ? '1' : '0');
    } catch {}
  }, [discreet]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_HIDE_SENSITIVE, hideSensitive ? '1' : '0');
    } catch {}
  }, [hideSensitive]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/reports/vitals?range=30d', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        const data = (await res.json().catch(() => null)) as VitalsReport | null;
        if (!cancelled) setReport(res.ok && data?.ok !== false ? data : null);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    timer.current = setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const latest = report?.latest;
  const generated = useMemo(() => {
    if (hideSensitive) return 'Hidden';
    if (!report?.generatedAtISO) return '—';
    const d = new Date(report.generatedAtISO);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }, [hideSensitive, report?.generatedAtISO]);

  async function getPdf() {
    setBusyExport(true);
    try {
      return await generateHealthReport('', {});
    } finally {
      setBusyExport(false);
    }
  }

  async function downloadPdf() {
    try {
      const { blob, filename } = await getPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'ambulant-health-report.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      toast('Download started.', 'success');
    } catch (error) {
      console.error(error);
      toast('Could not generate the report right now.', 'error');
    }
  }

  async function sharePdf() {
    try {
      const { blob, filename } = await getPdf();
      const file = new File([blob], filename || 'ambulant-health-report.pdf', {
        type: 'application/pdf',
      });

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Ambulant+ Health Report',
          text: 'My Ambulant+ health report.',
          files: [file],
        });
      } else {
        toast('File sharing is not supported on this device/browser.', 'info');
      }
    } catch (error) {
      console.error(error);
      toast('Could not share the report.', 'error');
    }
  }

  return (
    <main data-p-ui="patient-reports-page" className="min-h-screen min-w-0 overflow-x-clip bg-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Patient reports
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Your persisted health observations
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Reports use authenticated patient context. Missing or unverified measurements are shown as unavailable rather than estimated.
              </p>
              <p className="mt-2 text-xs text-slate-500">Last refresh: {generated}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDiscreet((value) => !value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {discreet ? 'Show values' : 'Discreet mode'}
              </button>
              <button
                type="button"
                onClick={() => setHideSensitive((value) => !value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {hideSensitive ? 'Show timing' : 'Hide timing'}
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={busyExport}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {busyExport ? 'Preparing…' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={sharePdf}
                disabled={busyExport}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Blood pressure', latest?.sys != null && latest?.dia != null ? `${fmt(latest.sys)}/${fmt(latest.dia)}` : '—', 'mmHg'],
              ['Heart rate', fmt(latest?.hr), 'bpm'],
              ['SpO₂', fmt(latest?.spo2), '%'],
              ['Temperature', fmt(latest?.temp_c, 1), '°C'],
              ['Respiratory rate', fmt(latest?.rr), 'rpm'],
              ['Glucose', fmt(latest?.glucose), 'mg/dL'],
            ].map(([label, value, unit]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-bold text-slate-950">
                  {discreet ? '•••' : value}
                  {!discreet && value !== '—' ? <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span> : null}
                </div>
              </div>
            ))}
          </div>
          {loading ? <p className="mt-3 text-xs text-slate-500">Refreshing observations…</p> : null}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {REPORTS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <Link
          href="/reports/print"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
        >
          <Thermometer className="h-4 w-4" />
          Build a section-specific printable report
        </Link>
      </div>
    </main>
  );
}
