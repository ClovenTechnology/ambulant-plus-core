import { NextRequest } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { buildLadyState, resolveLadyPatientContext, jsonErr } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FertilityReportResponse = {
  ok: boolean;
  patientId: string;
  range: string;
  generatedAtISO: string;
  mock?: boolean;
  summary?: {
    currentPhase?: string;
    confidence?: number;
    baselineTempC?: number | null;
    latestTempDelta?: number | null;
    avgHrv?: number | null;
    avgRhr?: number | null;
    likelyPregnancy?: boolean;
    pregnancyConfidence?: number;
  };
  latest?: {
    date?: string | null;
    deltaTemp?: number;
    tempC?: number;
    hrv?: number;
    rhr?: number;
    spo2?: number;
    phase?: string;
    confidence?: number;
  };
  trend?: Array<{
    date: string;
    deltaTemp?: number;
    tempC?: number;
    hrv?: number;
    rhr?: number;
    spo2?: number;
    phase?: string;
    confidence?: number;
  }>;
  insights?: {
    headline?: string;
    bullets?: string[];
    recommendations?: Array<{ title: string; detail: string }>;
  };
  sources?: Record<string, { source: string; recorded_at?: string | null; inferred?: boolean }>;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  h1: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 700,
  },
  h2: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 700,
  },
  meta: {
    color: '#475569',
    marginBottom: 10,
    fontSize: 10,
  },
  section: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stat: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    flexGrow: 1,
    flexBasis: 0,
  },
  statLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  subtle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  bullet: {
    marginTop: 4,
    color: '#334155',
  },
  smallTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 9,
    flexGrow: 1,
    flexBasis: 0,
  },
});

function fmtNum(v: any, digits = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

function fmtTs(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function modeLabel(mode?: string | null) {
  if (mode === 'cycle') return 'Cycle Tracking';
  if (mode === 'symptoms') return 'Symptoms Only';
  if (mode === 'pregnancy') return 'Pregnancy';
  if (mode === 'menopause') return 'Peri/Menopause';
  return 'Not configured';
}

async function fetchFertilityReport(origin: string, patientId: string, range: string) {
  const qs = new URLSearchParams({ patientId, range });
  try {
    const res = await fetch(`${origin}/api/reports/fertility?${qs.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as FertilityReportResponse | null;
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

function buildScreeningSummary(screening: Record<string, { lastDoneISO?: string | null }>) {
  const entries = Object.entries(screening || {});
  const done = entries.filter(([, v]) => !!v?.lastDoneISO).length;
  return {
    total: entries.length,
    done,
    pending: Math.max(0, entries.length - done),
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const range = req.nextUrl.searchParams.get('range') || '90d';
  const { prisma, patientId } = ctx;

  const [profile, docs, notes, screenings, dayLogs, fertility] = await Promise.all([
    prisma.ladyCenterProfile.findUnique({ where: { patientId } }),
    prisma.ladyCenterDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.ladyCenterNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.ladyCenterScreening.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.ladyCenterDayLog.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      take: 60,
    }),
    fetchFertilityReport(req.nextUrl.origin, patientId, range),
  ]);

  const updatedAtISO =
    [
      profile?.updatedAt,
      ...docs.map((x: any) => x.updatedAt),
      ...notes.map((x: any) => x.updatedAt),
      ...screenings.map((x: any) => x.updatedAt),
      ...dayLogs.map((x: any) => x.updatedAt),
    ]
      .filter(Boolean)
      .map((d: Date) => d.toISOString())
      .sort()
      .at(-1) || new Date().toISOString();

  const state = buildLadyState({
    profile,
    docs,
    notes,
    screenings,
    dayLogs,
    updatedAtISO,
  });

  const screeningSummary = buildScreeningSummary(state.screening);

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h1 }, 'Lady Center Report'),
      React.createElement(
        Text,
        { style: styles.meta },
        `Patient: ${patientId} • Range: ${String(range).toUpperCase()} • Generated: ${new Date().toLocaleString()}`
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Profile'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Mode'),
            React.createElement(Text, { style: styles.statValue }, modeLabel(state.profile?.mode))
          ),
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Track symptoms'),
            React.createElement(Text, { style: styles.statValue }, state.profile?.trackSymptoms ? 'On' : 'Off')
          ),
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Track vitals'),
            React.createElement(Text, { style: styles.statValue }, state.profile?.trackVitals ? 'On' : 'Off')
          ),
        ),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Fertility / cycle summary'),
        fertility?.ok
          ? React.createElement(
              View,
              null,
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Current phase'),
                  React.createElement(Text, { style: styles.statValue }, fertility.summary?.currentPhase || '—')
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Confidence'),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    `${fmtNum((fertility.summary?.confidence ?? 0) * 100, 0)}%`
                  )
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Pregnancy signal'),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    fertility.summary?.likelyPregnancy ? 'Likely' : 'None'
                  )
                ),
              ),
              React.createElement(
                Text,
                { style: styles.bullet },
                fertility.insights?.headline || 'Fertility summary derived from the patient-scoped fertility adapter.'
              ),
              ...(fertility.insights?.bullets || []).slice(0, 4).map((b, i) =>
                React.createElement(Text, { key: `fert-b-${i}`, style: styles.bullet }, `• ${b}`)
              ),
            )
          : React.createElement(
              Text,
              { style: styles.bullet },
              'Fertility report adapter unavailable.'
            ),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Day logs'),
        React.createElement(
          Text,
          { style: styles.bullet },
          `Tracked day logs: ${Object.keys(state.dayLogs || {}).length}`
        ),
        React.createElement(
          View,
          { style: styles.smallTable },
          React.createElement(
            View,
            { style: styles.tableHead },
            React.createElement(Text, { style: styles.cell }, 'Date'),
            React.createElement(Text, { style: styles.cell }, 'Period'),
            React.createElement(Text, { style: styles.cell }, 'Ovulation'),
            React.createElement(Text, { style: styles.cell }, 'Preg Test'),
            React.createElement(Text, { style: styles.cell }, 'Symptoms'),
          ),
          ...Object.values(state.dayLogs || {})
            .slice(-8)
            .reverse()
            .map((row: any, i) =>
              React.createElement(
                View,
                { key: `log-${i}`, style: styles.tableRow },
                React.createElement(Text, { style: styles.cell }, row.date || '—'),
                React.createElement(Text, { style: styles.cell }, row.period ? 'Yes' : '—'),
                React.createElement(Text, { style: styles.cell }, row.ovulation ? 'Yes' : '—'),
                React.createElement(Text, { style: styles.cell }, row.pregnancyTestPositive ? 'Yes' : '—'),
                React.createElement(Text, { style: styles.cell }, Array.isArray(row.symptoms) ? row.symptoms.slice(0, 3).join(', ') || '—' : '—'),
              )
            ),
        ),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Screening'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Tracked items'),
            React.createElement(Text, { style: styles.statValue }, String(screeningSummary.total))
          ),
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Completed'),
            React.createElement(Text, { style: styles.statValue }, String(screeningSummary.done))
          ),
          React.createElement(
            View,
            { style: styles.stat },
            React.createElement(Text, { style: styles.statLabel }, 'Pending'),
            React.createElement(Text, { style: styles.statValue }, String(screeningSummary.pending))
          ),
        ),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Notes & documents'),
        React.createElement(Text, { style: styles.bullet }, `Notes: ${state.notes.length}`),
        React.createElement(Text, { style: styles.bullet }, `Documents: ${state.docs.length}`),
        ...state.notes.slice(0, 4).map((n, i) =>
          React.createElement(Text, { key: `note-${i}`, style: styles.bullet }, `• ${n.text}`)
        ),
        ...state.docs.slice(0, 4).map((d, i) =>
          React.createElement(
            Text,
            { key: `doc-${i}`, style: styles.bullet },
            `• ${d.title} (${d.tag}) • ${fmtTs(d.createdISO)}`
          )
        ),
      ),
    )
  );

  const blob = await pdf(doc).toBlob();

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lady-center-${patientId}-${Date.now()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}