'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Download, Share2 } from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type StressPoint = {
  ts: string;
  stressIndex?: number;
  hrv?: number;
};

type StressReport = {
  ok?: boolean;
  range?: RangeKey;
  generatedAtISO?: string;
  inferenceMode?: 'direct_observations_only';
  summary?: {
    avgStressIndex?: number | null;
    avgHrv?: number | null;
    sampleCounts?: { directStress?: number; hrv?: number };
  };
  latest?: {
    ts?: string | null;
    stressIndex?: number;
    hrv?: number;
  };
  trend?: StressPoint[];
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
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function StressReportPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<StressReport | null>(null);
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
    fetch(`/api/reports/stress?range=${encodeURIComponent(range)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as StressReport | null;
        if (!res.ok || json?.ok === false) throw new Error('stress_report_unavailable');
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

  const rows = useMemo(
    () => (Array.isArray(data?.trend) ? data!.trend!.filter((row) => typeof row.stressIndex === 'number' || typeof row.hrv === 'number').slice(-60).reverse() : []),
    [data?.trend],
  );

  async function createPdf() {
    setPdfBusy(true);
    try { return await generateHealthReport('', { stress: true }); }
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
      a.download = filename || 'stress-report.pdf';
      a.click();
    } catch { toast('Could not generate the report.', 'error'); }
  }

  async function share() {
    try {
      const { blob, filename } = await createPdf();
      const file = new File([blob], filename || 'stress-report.pdf', { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Stress observations report', files: [file] });
      } else {
        toast('File sharing is not supported on this device/browser.', 'info');
      }
    } catch { toast('Could not share the report.', 'error'); }
  }

  return (
    <main data-p-ui="patient-stress-report" className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/reports" className="text-sm font-semibold text-cyan-300">← Reports</Link>
              <h1 className="mt-2 text-2xl font-black">Stress observations</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/65">
                Direct persisted stress measurements only. No stress score is synthesized from HRV, heart rate, sleep, activity, calories or distance.
              </p>
              <p className="mt-2 text-xs text-white/45">Generated: {fmtDate(data?.generatedAtISO, hideSensitive)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDiscreet((v) => !v)} className="rounded-full border border-white/15 px-3 py-2 text-sm">
                {discreet ? 'Show values' : 'Discreet'}
              </button>
              <button type="button" onClick={download} disabled={pdfBusy} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                <Download className="mr-1 inline h-4 w-4" /> Download
              </button>
              <button type="button" onClick={share} disabled={pdfBusy} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">
                <Share2 className="mr-1 inline h-4 w-4" /> Share
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {RANGES.map((item) => (
              <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1.5 text-sm ${range === item ? 'border-white bg-white text-slate-950' : 'border-white/15 text-white/75'}`}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {loading ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/65">Loading observations…</div> : null}

        {!loading ? (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Average direct stress', data?.summary?.avgStressIndex == null ? '—' : `${fmt(data.summary.avgStressIndex, 1)} / 100`],
                ['Direct stress samples', fmt(data?.summary?.sampleCounts?.directStress)],
                ['Average HRV', data?.summary?.avgHrv == null ? '—' : `${fmt(data.summary.avgHrv, 1)} ms`],
                ['HRV samples', fmt(data?.summary?.sampleCounts?.hrv)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs text-white/50">{label}</div>
                  <div className="mt-1 text-xl font-bold">{discreet ? '•••' : value}</div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04]">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center gap-2 font-bold"><Brain className="h-4 w-4" /> Direct observations</div>
                <p className="mt-1 text-xs text-white/50">{data?.insights?.headline || 'No direct persisted stress score is available.'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[620px] w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs text-white/45">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Direct stress</th>
                      <th className="px-4 py-3">HRV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((row, index) => (
                      <tr key={`${row.ts}-${index}`} className="border-t border-white/5">
                        <td className="px-4 py-3">{fmtDate(row.ts, hideSensitive)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.stressIndex)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.hrv == null ? '—' : `${fmt(row.hrv)} ms`}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-white/50">No direct persisted stress observations in this range.</td></tr>
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
