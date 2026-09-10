'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, EyeOff, HeartPulse, Share2 } from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { generateHealthReport } from '@/src/analytics/report';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type TrendPoint = {
  ts?: string | null;
  hr?: number | null;
  spo2?: number | null;
  temp_c?: number | null;
  sys?: number | null;
  dia?: number | null;
  glucose?: number | null;
  rr?: number | null;
  steps?: number | null;
};

type Report = {
  ok?: boolean;
  range?: RangeKey;
  generatedAtISO?: string;
  latest?: TrendPoint | null;
  trend?: TrendPoint[];
  sources?: Record<string, { source?: string; recorded_at?: string | null; inferred?: boolean } | undefined>;
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

export default function VitalsReportPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    try { localStorage.setItem(LS_DISCREET, discreet ? '1' : '0'); } catch {}
  }, [discreet]);

  useEffect(() => {
    try { localStorage.setItem(LS_HIDE_SENSITIVE, hideSensitive ? '1' : '0'); } catch {}
  }, [hideSensitive]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/reports/vitals?range=${encodeURIComponent(range)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as Report | null;
        if (!res.ok || json?.ok === false) throw new Error('vitals_report_unavailable');
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError('Vitals are unavailable right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const latest = data?.latest;
  const rows = useMemo(
    () => (Array.isArray(data?.trend) ? data!.trend!.slice(-30).reverse() : []),
    [data?.trend],
  );

  async function createPdf() {
    setPdfBusy(true);
    try {
      return await generateHealthReport('', { bp: true });
    } finally {
      setPdfBusy(false);
    }
  }

  async function download() {
    try {
      const { blob, filename } = await createPdf();
      const url = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'vitals-report.pdf';
      a.click();
    } catch {
      toast('Could not generate the report.', 'error');
    }
  }

  async function share() {
    try {
      const { blob, filename } = await createPdf();
      const file = new File([blob], filename || 'vitals-report.pdf', { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Vitals report', files: [file] });
      } else {
        toast('File sharing is not supported on this device/browser.', 'info');
      }
    } catch {
      toast('Could not share the report.', 'error');
    }
  }

  return (
    <main data-p-ui="patient-vitals-report" className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7">
        <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/reports" className="text-sm font-semibold text-cyan-700">← Reports</Link>
              <h1 className="mt-2 text-2xl font-black text-slate-950">Vitals report</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Direct persisted measurements only. Device-derived metrics without verified semantics are not presented here.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Generated: {fmtDate(data?.generatedAtISO, hideSensitive)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDiscreet((v) => !v)} className="rounded-full border px-3 py-2 text-sm">
                {discreet ? <Eye className="mr-1 inline h-4 w-4" /> : <EyeOff className="mr-1 inline h-4 w-4" />}
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
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`rounded-full border px-3 py-1.5 text-sm ${range === item ? 'bg-slate-950 text-white' : 'bg-white text-slate-700'}`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div> : null}
        {loading ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading observations…</div> : null}

        {!loading && data ? (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Blood pressure', latest?.sys != null && latest?.dia != null ? `${fmt(latest.sys)}/${fmt(latest.dia)}` : '—', 'mmHg'],
                ['Heart rate', fmt(latest?.hr), 'bpm'],
                ['SpO₂', fmt(latest?.spo2), '%'],
                ['Temperature', fmt(latest?.temp_c, 1), '°C'],
                ['Respiratory rate', fmt(latest?.rr), 'rpm'],
                ['Glucose', fmt(latest?.glucose), 'mg/dL'],
                ['Steps', fmt(latest?.steps), ''],
                ['Last reading', fmtDate(latest?.ts, hideSensitive), ''],
              ].map(([label, value, unit]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">
                    {discreet && label !== 'Last reading' ? '•••' : value}
                    {!discreet && unit && value !== '—' ? <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span> : null}
                  </div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <h2 className="font-bold text-slate-950">Recent persisted observations</h2>
                <p className="mt-1 text-xs text-slate-500">No local risk score or diagnostic classification is generated.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[820px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">BP</th>
                      <th className="px-4 py-3">HR</th>
                      <th className="px-4 py-3">SpO₂</th>
                      <th className="px-4 py-3">Temp</th>
                      <th className="px-4 py-3">RR</th>
                      <th className="px-4 py-3">Glucose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((row, index) => (
                      <tr key={`${row.ts || 'row'}-${index}`} className="border-t border-slate-100">
                        <td className="px-4 py-3">{fmtDate(row.ts, hideSensitive)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : row.sys != null && row.dia != null ? `${fmt(row.sys)}/${fmt(row.dia)}` : '—'}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.hr)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.spo2)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.temp_c, 1)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.rr)}</td>
                        <td className="px-4 py-3">{discreet ? '•••' : fmt(row.glucose)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No persisted observations in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <HeartPulse className="h-4 w-4" />
          This report is informational and does not replace clinical assessment.
        </div>
      </div>
    </main>
  );
}
