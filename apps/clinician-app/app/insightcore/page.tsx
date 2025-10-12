// apps/clinician-app/app/insightcore/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, CartesianGrid, YAxis } from 'recharts';
import { useRouter, useSearchParams } from 'next/navigation';
import Sparkline from '@/src/components/Sparkline';
import { lttbDownsample, Point } from '@/utils/lttb';

type Resp = { metric: string; series: Point[]; mock?: boolean; upstreamMs?: number; aggregated?: boolean };

/* -----------------------
  fetchInsight uses server-side aggregation param
-------------------------*/
const fetchInsight = async ([metric, from, to, aggregate]: string[]) => {
  const res = await fetch('/api/insightcore/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ metric, from, to, aggregate }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err: any = new Error('InsightCore query failed');
    err.detail = text;
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as Resp;
};

function fmtShort(d?: string) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
}

export default function InsightCorePage() {
  const router = useRouter();
  const search = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const isoNow = useMemo(() => now.toISOString().slice(0, 16), [now]); // YYYY-MM-DDTHH:mm

  const initialMetric = search?.get('metric') ?? 'utilization';
  const initialFrom = search?.get('from') ?? new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16);
  const initialTo = search?.get('to') ?? isoNow;
  const initialAggregate = search?.get('aggregate') ?? 'auto';
  const initialMaxPoints = Number(search?.get('max') ?? 500);

  const [metric, setMetric] = useState(initialMetric);
  const [fromLocal, setFromLocal] = useState(initialFrom);
  const [toLocal, setToLocal] = useState(initialTo);
  const [aggregate, setAggregate] = useState<string>(initialAggregate);
  const [maxPoints, setMaxPoints] = useState<number>(initialMaxPoints);
  const [autoRunDebounceMs] = useState(600);
  const [downsampled, setDownsampled] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);

  const toIso = (localVal: string) => {
    if (!localVal) return '';
    const dt = new Date(localVal);
    return dt.toISOString();
  };

  const from = useMemo(() => toIso(fromLocal), [fromLocal]);
  const to = useMemo(() => toIso(toLocal), [toLocal]);

  const key = useMemo(() => {
    if (!metric || !from || !to) return null;
    return [metric, from, to, aggregate];
  }, [metric, from, to, aggregate]);

  const { data, error, isValidating, mutate } = useSWR(key, fetchInsight, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    const tid = setTimeout(() => {
      const q = new URLSearchParams();
      q.set('metric', metric);
      q.set('from', fromLocal);
      q.set('to', toLocal);
      q.set('aggregate', aggregate);
      q.set('max', String(maxPoints));
      router.replace(`/insightcore?${q.toString()}`);
    }, 700);
    return () => clearTimeout(tid);
  }, [metric, fromLocal, toLocal, aggregate, maxPoints, router]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (key) mutate();
    }, autoRunDebounceMs);
    return () => clearTimeout(id);
  }, [metric, fromLocal, toLocal, aggregate, mutate, key, autoRunDebounceMs]);

  const runNow = useCallback(() => {
    if (key) mutate();
  }, [mutate, key]);

  const rawSeries: Point[] = useMemo(() => (data && Array.isArray(data.series) ? data.series : []), [data]);

  const series = useMemo(() => {
    setDownsampled(false);
    if (!rawSeries || rawSeries.length === 0) return [];
    const sorted = rawSeries.slice().sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    if (sorted.length <= maxPoints) return sorted;
    const reduced = lttbDownsample(sorted, Math.max(3, maxPoints));
    setDownsampled(true);
    return reduced;
  }, [rawSeries, maxPoints]);

  const csvDownload = useCallback(() => {
    if (!series || !series.length) return;
    const csv = ['time,value', ...series.map((p) => `${p.t},${p.v}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insight-${metric}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [series, metric]);

  const exportPng = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `insight-${metric}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('PNG export failed', e);
      alert('PNG export failed. See console for details.');
    }
  }, [metric]);

  const applyPreset = (label: string) => {
    const now = new Date();
    let earlier = new Date();
    switch (label) {
      case '1h': earlier = new Date(now.getTime() - 60 * 60 * 1000); break;
      case '6h': earlier = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
      case '24h': earlier = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d': earlier = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    }
    setFromLocal(earlier.toISOString().slice(0, 16));
    setToLocal(now.toISOString().slice(0, 16));
  };

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">InsightCore — Live Metrics</h1>
          <p className="text-sm text-gray-500 mt-1">Query your InsightCore metrics (server-backed). Dates are in your local timezone.</p>
        </div>

        <div className="flex gap-2 items-center">
          <button className="px-3 py-1 rounded border text-sm hover:bg-gray-50" onClick={csvDownload} disabled={!series || series.length === 0} title="Export CSV">Export CSV</button>
          <button className="px-3 py-1 rounded border text-sm hover:bg-gray-50" onClick={exportPng} disabled={!series || series.length === 0} title="Export PNG snapshot">Export PNG</button>
          <button className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={runNow} disabled={isValidating}>{isValidating ? 'Running…' : 'Run'}</button>
        </div>
      </header>

      <section className="bg-white border rounded p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500">Metric</label>
            <select className="border rounded px-2 py-1 block" value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="utilization">utilization</option>
              <option value="avg_wait">avg_wait</option>
              <option value="throughput">throughput</option>
              <option value="errors">errors</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">From</label>
            <input type="datetime-local" className="border rounded px-2 py-1 block w-64" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">{fmtShort(from)}</div>
          </div>

          <div>
            <label className="text-xs text-gray-500">To</label>
            <input type="datetime-local" className="border rounded px-2 py-1 block w-64" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">{fmtShort(to)}</div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Aggregation</label>
            <select className="border rounded px-2 py-1 block" value={aggregate} onChange={(e) => setAggregate(e.target.value)}>
              <option value="auto">auto (server decides)</option>
              <option value="none">none</option>
              <option value="minute">minute</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="hour">hour</option>
              <option value="day">day</option>
            </select>
            <div className="text-xs text-gray-400 mt-1">“auto” lets the server pick the best bucket. Recommended maxPoints ≤ 500 for client LTTB.</div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Max points (client)</label>
            <input type="number" min={50} max={2000} className="border rounded px-2 py-1 w-32" value={String(maxPoints)} onChange={(e) => setMaxPoints(Math.max(50, Math.min(2000, Number(e.target.value) || 500)))} />
            <div className="text-xs text-gray-400 mt-1">Client LTTB cap (suggested ≤ 500 for performance)</div>
          </div>

          <div className="ml-2 flex gap-1 items-center">
            <div className="text-xs text-gray-500">Presets</div>
            {['1h', '6h', '24h', '7d'].map(p => (
              <button key={p} className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => applyPreset(p)}>{p}</button>
            ))}
          </div>
        </div>

        {error && <div className="text-sm text-rose-600">Error: {(error as any).detail || (error as any).message || 'Unknown error'}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Preview</div>
                <div className="text-lg font-semibold">{metric}</div>
                <div className="text-xs text-gray-400">Range: {fmtShort(from)} → {fmtShort(to)} {data?.mock ? ' • mock' : ''}</div>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">Points</div>
                <div className="font-medium tabular-nums">{series.length}</div>
                {data?.upstreamMs !== undefined && <div className="text-xs text-gray-400">Upstream: {data.upstreamMs}ms</div>}
                {data?.aggregated && <div className="text-xs text-gray-400">Aggregated</div>}
                {downsampled && <div className="text-xs text-amber-600">Downsampled (LTTB)</div>}
              </div>
            </div>

            <div className="mt-3 bg-slate-50 p-3 rounded border">
              {isValidating ? (
                <div className="h-20 w-full bg-slate-200 animate-pulse rounded" />
              ) : (
                <Sparkline data={series} color="#2563eb" height={64} gradientId="insight-preview-grad" />
              )}
            </div>
          </div>

          <div className="p-3 bg-white border rounded shadow-sm">
            <div className="text-xs text-gray-600">Last datapoint</div>
            <div className="text-lg font-semibold tabular-nums">{series.length ? String(series[series.length - 1].v) : '—'}</div>
            <div className="text-xs text-gray-400 mt-1">{series.length ? new Date(series[series.length - 1].t).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="bg-white border rounded p-3">
            <div className="text-sm text-gray-600 mb-2">Interactive Chart</div>
            <div style={{ height: 320 }} ref={chartRef}>
              {isValidating && (!series || !series.length) ? (
                <div className="h-full w-full bg-slate-100 animate-pulse rounded" />
              ) : series && series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.map((p) => ({ ...p, date: p.t }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`${value}`, 'Value']} labelFormatter={(label: any) => new Date(label).toLocaleString()} />
                    <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-sm text-gray-400">No data for this range.</div>
              )}
            </div>
          </div>

          <div className="bg-white border rounded p-3 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Data points</div>
              <div className="text-xs text-gray-400">Total: {series.length}</div>
            </div>

            <div className="max-h-[280px] overflow-auto">
              {isValidating && (!series || !series.length) ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 bg-slate-100 animate-pulse rounded" />)}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Time</th>
                      <th className="text-right p-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((p, i) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        <td className="p-2">{new Date(p.t).toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{p.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
