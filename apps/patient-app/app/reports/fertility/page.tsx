'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, HeartPulse, Share2, ShieldCheck, Thermometer } from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '30d' | '90d' | '1y';

type FertilityPoint = {
  date: string;
  deltaTemp?: number;
  tempC?: number;
  hrv?: number;
  spo2?: number;
};

type FertilityReport = {
  ok?: boolean;
  range?: RangeKey;
  generatedAtISO?: string;
  inferenceMode?: 'observational_only';
  summary?: {
    baselineTempC?: number | null;
    latestTempDelta?: number | null;
    avgHrv?: number | null;
    sampleCounts?: {
      temperature?: number;
      temperatureDeviation?: number;
      hrv?: number;
      spo2?: number;
    };
  };
  latest?: FertilityPoint | { date: null };
  trend?: FertilityPoint[];
  insights?: {
    headline?: string;
    bullets?: string[];
    recommendations?: Array<{ title: string; detail: string }>;
  };
};

const RANGES: RangeKey[] = ['30d', '90d', '1y'];
const LS_DISCREET = 'ambulant.reports.discreet';
const LS_HIDE_SENSITIVE = 'ambulant.reports.hideSensitive';
const LEGACY_FERTILITY_PREFS = 'fertilityPrefs';

function fmt(value: number | null | undefined, digits = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
    : '—';
}

function fmtDate(value?: string | null, hidden?: boolean) {
  if (hidden) return 'Hidden';
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function FertilityReportPage() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [data, setData] = useState<FertilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    try {
      setDiscreet((localStorage.getItem(LS_DISCREET) || '0') === '1');
      setHideSensitive((localStorage.getItem(LS_HIDE_SENSITIVE) || '0') === '1');
      // Historical reproductive-health preferences must not persist in browser storage.
      localStorage.removeItem(LEGACY_FERTILITY_PREFS);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_DISCREET, discreet ? '1' : '0'); } catch {} }, [discreet]);
  useEffect(() => { try { localStorage.setItem(LS_HIDE_SENSITIVE, hideSensitive ? '1' : '0'); } catch {} }, [hideSensitive]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/fertility?range=${encodeURIComponent(range)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as FertilityReport | null;
        if (!res.ok || json?.ok === false) throw new Error('fertility_report_unavailable');
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
    () => (Array.isArray(data?.trend) ? data!.trend!.slice(-90).reverse() : []),
    [data?.trend],
  );

  async function createPdf() {
    setPdfBusy(true);
    try { return await generateHealthReport('', { fertility: true }); }
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
      a.download = filename || 'reproductive-health-report.pdf';
      a.click();
    } catch { toast('Could not generate the report.', 'error'); }
  }

  async function share() {
    try {
      const { blob, filename } = await createPdf();
      const file = new File([blob], filename || 'reproductive-health-report.pdf', { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Reproductive-health observations', files: [file] });
      } else {
        toast('File sharing is not supported on this device/browser.', 'info');
      }
    } catch { toast('Could not share the report.', 'error'); }
  }

  return (
    <main data-p-ui="patient-fertility-report" className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7">
        <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/reports" className="text-sm font-semibold text-cyan-700">← Reports</Link>
              <h1 className="mt-2 text-2xl font-black text-slate-950">Reproductive-health observations</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                This report is observational only. It does not infer cycle phase, ovulation or pregnancy from wearable physiology.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                No browser-stored LMP/cycle preferences
              </div>
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

        {loading ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading persisted observations…</div> : null}

        {!loading ? (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Temperature samples', fmt(data?.summary?.sampleCounts?.temperature)],
                ['Temperature deviation samples', fmt(data?.summary?.sampleCounts?.temperatureDeviation)],
                ['Average HRV', data?.summary?.avgHrv == null ? '—' : `${fmt(data.summary.avgHrv, 1)} ms`],
                ['SpO₂ samples', fmt(data?.summary?.sampleCounts?.spo2)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{discreet ? '•••' : value}</div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-4">
                <h2 className="font-bold text-slate-950">Persisted observations</h2>
                <p className="mt-1 text-xs text-slate-500">{data?.insights?.headline || 'No persisted observations are available.'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Temperature</th>
                      <th className="px-4 py-3">Temperature Δ</th>
                      <th className="px-4 py-3">HRV</th>
                      <th className="px-4 py-3">SpO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((row) => (
                      <tr key={row.date} className="border-t border-slate-100">
                        <td className="px-4 py-3">{fmtDate(row.date, hideSensitive)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.tempC == null ? '—' : `${fmt(row.tempC, 2)} °C`}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.deltaTemp == null ? '—' : `${row.deltaTemp >= 0 ? '+' : ''}${fmt(row.deltaTemp, 2)} °C`}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.hrv == null ? '—' : `${fmt(row.hrv)} ms`}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.spo2 == null ? '—' : `${fmt(row.spo2)}%`}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No persisted observations in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Thermometer className="h-4 w-4" />
              <HeartPulse className="h-4 w-4" />
              Measurements are displayed as observations only; no fertility or pregnancy conclusion is generated.
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
