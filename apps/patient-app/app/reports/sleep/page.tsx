'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Moon, Share2 } from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type SleepStages = { rem: number; deep: number; light: number; awake: number };

type SleepNight = {
  dateISO: string;
  bedtimeISO?: string | null;
  wakeISO?: string | null;
  stagesMin: SleepStages;
  totalMinutes: number;
  hrv?: number | null;
  efficiency?: number | null;
  qualityScore?: null;
  qualityLabel?: string;
};

type SleepReport = {
  ok?: boolean;
  range?: RangeKey;
  generatedAtISO?: string;
  nights?: SleepNight[];
  insights?: {
    headline?: string;
    highlights?: Array<{ title: string; detail: string }>;
    recommendations?: Array<{ title: string; detail: string }>;
  };
};

const RANGES: RangeKey[] = ['7d', '30d', '90d', '1y'];
const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';

function fmt(value: number | null | undefined, digits = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
    : '—';
}

function fmtDate(value?: string | null, hidden?: boolean) {
  if (hidden) return 'Hidden';
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function SleepReportPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<SleepReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    try {
      setDiscreet((localStorage.getItem(LS_DISCREET) || '0') === '1');
      setHideSensitive((localStorage.getItem(LS_HIDE_SENSITIVE) || '0') === '1');
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_DISCREET, discreet ? '1' : '0'); } catch {} }, [discreet]);
  useEffect(() => { try { localStorage.setItem(LS_HIDE_SENSITIVE, hideSensitive ? '1' : '0'); } catch {} }, [hideSensitive]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/sleep?range=${encodeURIComponent(range)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as SleepReport | null;
        if (!res.ok || json?.ok === false) throw new Error('sleep_report_unavailable');
        return json;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const nights = useMemo(
    () => (Array.isArray(data?.nights) ? data!.nights!.slice().reverse() : []),
    [data?.nights],
  );

  const avgDuration = useMemo(() => {
    const values = nights.map((night) => night.totalMinutes).filter(Number.isFinite);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }, [nights]);

  async function createPdf() {
    setPdfBusy(true);
    try { return await generateHealthReport('', { sleep: true }); }
    finally { setPdfBusy(false); }
  }

  async function download() {
    try {
      const { blob, filename } = await createPdf();
      const url = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'sleep-report.pdf';
      a.click();
    } catch { toast('Could not generate the report.', 'error'); }
  }

  async function share() {
    try {
      const { blob, filename } = await createPdf();
      const file = new File([blob], filename || 'sleep-report.pdf', { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Sleep report', files: [file] });
      } else {
        toast('File sharing is not supported on this device/browser.', 'info');
      }
    } catch { toast('Could not share the report.', 'error'); }
  }

  return (
    <main data-p-ui="patient-sleep-report" className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7">
        <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/reports" className="text-sm font-semibold text-cyan-700">← Reports</Link>
              <h1 className="mt-2 text-2xl font-black text-slate-950">Sleep report</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Persisted sleep-stage and duration observations. Sleep quality, readiness and resting-heart-rate scores are not estimated when semantics are unverified.
              </p>
              <p className="mt-2 text-xs text-slate-500">Generated: {fmtDate(data?.generatedAtISO, hideSensitive)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDiscreet((v) => !v)} className="rounded-full border px-3 py-2 text-sm">
                {discreet ? 'Show values' : 'Discreet'}
              </button>
              <button type="button" onClick={download} disabled={pdfBusy} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Download className="mr-1 inline h-4 w-4" /> Download
              </button>
              <button type="button" onClick={share} disabled={pdfBusy} className="rounded-full border px-4 py-2 text-sm font-semibold">
                <Share2 className="mr-1 inline h-4 w-4" /> Share
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {RANGES.map((item) => (
              <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1.5 text-sm ${range === item ? 'bg-slate-950 text-white' : 'bg-white text-slate-700'}`}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {loading ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading sleep observations…</div> : null}

        {!loading ? (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500">Recorded nights</div>
                <div className="mt-1 text-2xl font-bold">{discreet ? '•••' : nights.length}</div>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500">Average duration</div>
                <div className="mt-1 text-2xl font-bold">{discreet ? '•••' : avgDuration == null ? '—' : `${fmt(avgDuration / 60, 1)} h`}</div>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500">Quality score</div>
                <div className="mt-1 text-2xl font-bold text-slate-500">Unavailable</div>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500">Readiness</div>
                <div className="mt-1 text-2xl font-bold text-slate-500">Unavailable</div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-4">
                <div className="flex items-center gap-2 font-bold text-slate-950"><Moon className="h-4 w-4" /> Sleep history</div>
                <p className="mt-1 text-xs text-slate-500">{data?.insights?.headline || 'No persisted sleep history is available.'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Deep</th>
                      <th className="px-4 py-3">REM</th>
                      <th className="px-4 py-3">Light</th>
                      <th className="px-4 py-3">Awake</th>
                      <th className="px-4 py-3">Efficiency</th>
                      <th className="px-4 py-3">HRV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nights.length ? nights.map((night) => (
                      <tr key={night.dateISO} className="border-t border-slate-100">
                        <td className="px-4 py-3">{fmtDate(night.dateISO, hideSensitive)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : `${fmt(night.totalMinutes)} min`}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(night.stagesMin?.deep)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(night.stagesMin?.rem)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(night.stagesMin?.light)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(night.stagesMin?.awake)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : night.efficiency == null ? '—' : `${fmt(night.efficiency)}%`}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : night.hrv == null ? '—' : `${fmt(night.hrv)} ms`}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No persisted sleep observations in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
