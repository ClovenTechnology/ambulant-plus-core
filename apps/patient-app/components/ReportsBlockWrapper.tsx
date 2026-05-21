// apps/patient-app/components/ReportsBlockWrapper.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, RefreshCw, ShieldCheck } from 'lucide-react';

type ReportSummary = {
  id: string;
  title: string;
  date?: string | null;
  module?: string | null;
  href?: string;
  source?: string | null;
  available?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function safeDate(value?: string | null) {
  if (!value) return 'Awaiting data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Awaiting data';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function normaliseVitalsReport(payload: unknown): ReportSummary[] {
  if (!isRecord(payload)) return [];

  const latest = isRecord(payload.latest) ? payload.latest : null;
  const trend = Array.isArray(payload.trend) ? payload.trend : [];
  const summary = isRecord(payload.summary) ? payload.summary : null;
  const hasReadings = Boolean(latest?.ts || trend.length > 0 || summary?.readingCounts);

  if (!hasReadings) return [];

  return [
    {
      id: 'vitals-report',
      title: 'Vitals intelligence report',
      date: asString(latest?.ts ?? payload.generatedAtISO ?? payload.lastUpdated, ''),
      module: 'Health Monitor',
      href: '/reports/vitals',
      source: 'Live telemetry',
      available: true,
    },
  ];
}

function normalisePatientReports(payload: unknown): ReportSummary[] {
  const root = isRecord(payload) ? payload : {};
  const raw = Array.isArray(root.reports)
    ? root.reports
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.documents)
        ? root.documents
        : [];

  return raw
    .map((item): ReportSummary | null => {
      if (!isRecord(item)) return null;

      const id = asString(item.id ?? item.reportId ?? item.documentId).trim();
      const title = asString(item.title ?? item.name ?? item.fileName).trim();
      if (!id || !title) return null;

      return {
        id,
        title,
        date: asString(item.date ?? item.createdAt ?? item.updatedAt ?? item.generatedAtISO, ''),
        module: asString(item.module ?? item.documentKind ?? item.source, ''),
        href: asString(item.href ?? item.url, '') || `/reports/${encodeURIComponent(id)}`,
        source: asString(item.source ?? item.sourceApp ?? item.sourceType, ''),
        available: true,
      };
    })
    .filter((item): item is ReportSummary => Boolean(item))
    .slice(0, 5);
}

export default function ReportsBlockWrapper() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [patientReportsRes, vitalsRes] = await Promise.allSettled([
        fetch('/api/reports/patient', { cache: 'no-store' }),
        fetch('/api/reports/vitals', { cache: 'no-store' }),
      ]);

      const next: ReportSummary[] = [];

      if (patientReportsRes.status === 'fulfilled' && patientReportsRes.value.ok) {
        const data = await patientReportsRes.value.json().catch(() => null);
        next.push(...normalisePatientReports(data));
      }

      if (vitalsRes.status === 'fulfilled' && vitalsRes.value.ok) {
        const data = await vitalsRes.value.json().catch(() => null);
        next.push(...normaliseVitalsReport(data));
      }

      const seen = new Set<string>();
      const unique = next.filter((item) => {
        const key = item.id || item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      unique.sort((a, b) => {
        const at = a.date ? Date.parse(a.date) : 0;
        const bt = b.date ? Date.parse(b.date) : 0;
        return bt - at;
      });

      setReports(unique.slice(0, 5));
      setRefreshedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Reports could not be refreshed.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshedLabel = useMemo(() => {
    if (!refreshedAt) return 'Not refreshed yet';
    const d = new Date(refreshedAt);
    if (Number.isNaN(d.getTime())) return 'Refreshed recently';
    return `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [refreshedAt]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified sources
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          Refresh
        </button>
      </div>

      {loading && reports.length === 0 ? (
        <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-sm">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-[22px] border border-amber-100 bg-amber-50/70 p-4 text-sm leading-6 text-amber-800">
          Reports were not refreshed. Existing care data remains available in the relevant modules.
        </div>
      ) : null}

      {!loading && reports.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/74 p-5 text-sm leading-6 text-slate-600">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">No reports yet</div>
              <p className="mt-1">
                Generated summaries, uploaded results, and clinician documents will appear here once they are available from verified patient records.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {reports.length > 0 ? (
        <ul className="space-y-2.5">
          {reports.map((report) => (
            <li
              key={report.id}
              className="group rounded-[24px] border border-white/75 bg-white/88 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-100 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-indigo-50 text-cyan-700">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{report.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>{safeDate(report.date)}</span>
                      {report.module ? <span>• {report.module}</span> : null}
                      {report.source ? <span>• {report.source}</span> : null}
                    </div>
                  </div>
                </div>
                <Link
                  href={report.href || '/reports'}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition group-hover:border-cyan-200 group-hover:text-cyan-700"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="text-[11px] font-medium text-slate-400">{refreshedLabel}</div>
    </div>
  );
}
