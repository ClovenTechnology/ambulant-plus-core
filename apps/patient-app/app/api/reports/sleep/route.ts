import { NextRequest } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type ExportSections = {
  bp?: boolean;
  sleep?: boolean;
  stress?: boolean;
  fertility?: boolean;
  antenatal?: boolean;
  antenatalHandoff?: boolean;
};

type Body = {
  patientId?: string;
  range?: RangeKey;
  sections?: ExportSections;
  signOff?: boolean;
  clinicianName?: string;
};

type VitalsReportResponse = {
  ok: boolean;
  patientId: string;
  range: RangeKey | string;
  generatedAtISO: string;
  summary?: {
    avgHR?: number | null;
    avgSpO2?: number | null;
    avgTempC?: number | null;
    avgSys?: number | null;
    avgDia?: number | null;
    avgGlucose?: number | null;
    readingCounts?: Record<string, number>;
  };
  latest?: {
    ts?: string | null;
    hr?: number;
    spo2?: number;
    temp_c?: number;
    sys?: number;
    dia?: number;
    glucose?: number;
  };
  trend?: Array<{
    ts: string;
    hr?: number;
    spo2?: number;
    temp_c?: number;
    sys?: number;
    dia?: number;
    glucose?: number;
  }>;
  sources?: Record<string, { source: string; recorded_at?: string | null; inferred?: boolean }>;
};

type SleepStages = {
  rem: number;
  deep: number;
  light: number;
  awake: number;
};

type SleepReportResponse = {
  ok: boolean;
  patientId?: string;
  userId?: string;
  range: RangeKey | string;
  generatedAtISO: string;
  mock?: boolean;
  nights?: Array<{
    dateISO: string;
    bedtimeISO: string;
    wakeISO: string;
    stagesMin: SleepStages;
    hrv: number;
    efficiency: number;
    qualityScore: number;
    qualityLabel: string;
    note?: string | null;
  }>;
  insights?: {
    headline?: string;
    highlights?: Array<{ title: string; detail: string }>;
    recommendations?: Array<{ title: string; detail: string }>;
  };
  sources?: Record<string, { source: string; recorded_at?: string | null; inferred?: boolean }>;
};

type GenericAdapterResponse = {
  ok?: boolean;
  patientId?: string;
  userId?: string;
  range?: string;
  generatedAtISO?: string;
  summary?: Record<string, any>;
  latest?: Record<string, any>;
  insights?: {
    headline?: string;
    highlights?: Array<{ title: string; detail: string }>;
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
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
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
  divider: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
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
  sign: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    color: '#475569',
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

function stageHours(stages?: SleepStages) {
  if (!stages) return '—';
  const mins = stages.deep + stages.rem + stages.light;
  return `${fmtNum(mins / 60, 1)} h`;
}

function buildSourceLine(sources?: Record<string, { source: string }>, keys: string[] = []) {
  if (!sources) return 'Unavailable';
  const labels = keys
    .map((k) => sources[k]?.source)
    .filter((v): v is string => !!v);
  const unique = Array.from(new Set(labels));
  return unique.length ? unique.join(' • ') : 'Unavailable';
}

async function fetchAdapter<T>(
  origin: string,
  pathname: string,
  params: Record<string, string | undefined>,
): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.length) qs.set(k, v);
  }

  const url = `${origin}${pathname}${qs.toString() ? `?${qs.toString()}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

function wantsAll(sections?: ExportSections) {
  if (!sections) return true;
  return !Object.values(sections).some(Boolean);
}

export async function POST(req: NextRequest) {
  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const patientId = body?.patientId || 'patient-123';
  const range: RangeKey = body?.range || '30d';
  const sections = body?.sections || {};
  const signOff = body?.signOff ?? false;
  const clinicianName = body?.clinicianName || '';

  const includeVitals = wantsAll(sections) || !!sections.bp;
  const includeSleep = wantsAll(sections) || !!sections.sleep;
  const includeStress = wantsAll(sections) || !!sections.stress;
  const includeFertility = wantsAll(sections) || !!sections.fertility;

  const origin = new URL(req.url).origin;

  const [vitals, sleep, stress, fertility] = await Promise.all([
    includeVitals
      ? fetchAdapter<VitalsReportResponse>(origin, '/api/reports/vitals', { patientId, range })
      : Promise.resolve(null),
    includeSleep
      ? fetchAdapter<SleepReportResponse>(origin, '/api/reports/sleep', { patientId, range })
      : Promise.resolve(null),
    includeStress
      ? fetchAdapter<GenericAdapterResponse>(origin, '/api/reports/stress', { patientId, range })
      : Promise.resolve(null),
    includeFertility
      ? fetchAdapter<GenericAdapterResponse>(origin, '/api/reports/fertility', { patientId, range })
      : Promise.resolve(null),
  ]);

  const nodes: React.ReactNode[] = [];

  nodes.push(
    React.createElement(
      View,
      { key: 'header' },
      React.createElement(Text, { style: styles.h1 }, 'Ambulant+ Health Report'),
      React.createElement(
        Text,
        { style: styles.meta },
        `Patient: ${patientId} • Range: ${String(range).toUpperCase()} • Generated: ${new Date().toLocaleString()}`
      ),
    )
  );

  if (includeVitals) {
    nodes.push(
      React.createElement(
        View,
        { key: 'vitals', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Vitals'),
        vitals?.ok
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Latest BP'),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    `${fmtNum(vitals.latest?.sys, 0)}/${fmtNum(vitals.latest?.dia, 0)} mmHg`
                  ),
                  React.createElement(Text, { style: styles.subtle }, `Source: ${buildSourceLine(vitals.sources, ['sys', 'dia'])}`)
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Heart Rate'),
                  React.createElement(Text, { style: styles.statValue }, `${fmtNum(vitals.latest?.hr, 0)} bpm`),
                  React.createElement(Text, { style: styles.subtle }, `Source: ${buildSourceLine(vitals.sources, ['hr'])}`)
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'SpO₂'),
                  React.createElement(Text, { style: styles.statValue }, `${fmtNum(vitals.latest?.spo2, 0)} %`),
                  React.createElement(Text, { style: styles.subtle }, `Source: ${buildSourceLine(vitals.sources, ['spo2'])}`)
                )
              ),
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Average SYS / DIA'),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    `${fmtNum(vitals.summary?.avgSys, 0)}/${fmtNum(vitals.summary?.avgDia, 0)} mmHg`
                  )
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Average Glucose'),
                  React.createElement(Text, { style: styles.statValue }, `${fmtNum(vitals.summary?.avgGlucose, 0)} mg/dL`)
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Latest Timestamp'),
                  React.createElement(Text, { style: styles.statValue }, fmtTs(vitals.latest?.ts))
                )
              )
            )
          : React.createElement(Text, { style: styles.bullet }, 'Vitals adapter unavailable.')
      )
    );
  }

  if (includeSleep) {
    const nights = sleep?.nights || [];
    const recent = nights.slice(-5).reverse();

    nodes.push(
      React.createElement(
        View,
        { key: 'sleep', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Sleep'),
        sleep?.ok
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(
                Text,
                { style: styles.bullet },
                sleep.insights?.headline ||
                  'Sleep report summary derived from the patient sleep adapter.'
              ),
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Sleep source'),
                  React.createElement(Text, { style: styles.statValue }, buildSourceLine(sleep.sources, ['sleep']))
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'HRV source'),
                  React.createElement(Text, { style: styles.statValue }, buildSourceLine(sleep.sources, ['hrv']))
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.statLabel }, 'Mode'),
                  React.createElement(Text, { style: styles.statValue }, sleep.mock ? 'Demo fallback' : 'Persisted')
                )
              ),
              React.createElement(
                View,
                { style: styles.smallTable },
                React.createElement(
                  View,
                  { style: styles.tableHead },
                  React.createElement(Text, { style: styles.cell }, 'Night'),
                  React.createElement(Text, { style: styles.cell }, 'Duration'),
                  React.createElement(Text, { style: styles.cell }, 'Quality'),
                  React.createElement(Text, { style: styles.cell }, 'HRV'),
                ),
                ...recent.map((n, i) =>
                  React.createElement(
                    View,
                    { key: `sleep-row-${i}`, style: styles.tableRow },
                    React.createElement(Text, { style: styles.cell }, n.dateISO),
                    React.createElement(Text, { style: styles.cell }, stageHours(n.stagesMin)),
                    React.createElement(Text, { style: styles.cell }, `${fmtNum(n.qualityScore, 0)} (${n.qualityLabel})`),
                    React.createElement(Text, { style: styles.cell }, `${fmtNum(n.hrv, 0)} ms`)
                  )
                )
              )
            )
          : React.createElement(Text, { style: styles.bullet }, 'Sleep adapter unavailable.')
      )
    );
  }

  if (includeStress) {
    nodes.push(
      React.createElement(
        View,
        { key: 'stress', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Stress & HRV'),
        stress?.ok
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(
                Text,
                { style: styles.bullet },
                stress.insights?.headline || 'Stress section loaded from the stress adapter.'
              ),
              React.createElement(
                Text,
                { style: styles.bullet },
                `Summary keys: ${Object.keys(stress.summary || {}).join(', ') || 'None'}`
              ),
              React.createElement(
                Text,
                { style: styles.bullet },
                `Sources: ${buildSourceLine(stress.sources, Object.keys(stress.sources || {}))}`
              )
            )
          : React.createElement(
              Text,
              { style: styles.bullet },
              'Stress adapter unavailable or not yet wired. This section will populate automatically once /api/reports/stress is live.'
            )
      )
    );
  }

  if (includeFertility) {
    nodes.push(
      React.createElement(
        View,
        { key: 'fertility', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Fertility'),
        fertility?.ok
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(
                Text,
                { style: styles.bullet },
                fertility.insights?.headline || 'Fertility section loaded from the fertility adapter.'
              ),
              React.createElement(
                Text,
                { style: styles.bullet },
                `Summary keys: ${Object.keys(fertility.summary || {}).join(', ') || 'None'}`
              ),
              React.createElement(
                Text,
                { style: styles.bullet },
                `Sources: ${buildSourceLine(fertility.sources, Object.keys(fertility.sources || {}))}`
              )
            )
          : React.createElement(
              Text,
              { style: styles.bullet },
              'Fertility adapter unavailable or not yet wired. This section will populate automatically once /api/reports/fertility is live.'
            )
      )
    );
  }

  if (signOff) {
    nodes.push(
      React.createElement(
        View,
        { key: 'sign', style: styles.sign },
        React.createElement(Text, { style: { fontWeight: 700 } as any }, 'Clinician Sign-off'),
        React.createElement(Text, null, `Clinician: ${clinicianName || '_________________________'}`),
        React.createElement(Text, null, 'Date: _______________________'),
        React.createElement(Text, null, 'Signature: ___________________'),
      )
    );
  }

  const doc = React.createElement(
    Document,
    null,
    React.createElement(Page, { size: 'A4', style: styles.page }, ...nodes),
  );

  const blob = await pdf(doc).toBlob();

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ambulant-report-${patientId}-${Date.now()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}