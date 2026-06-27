import { NextRequest, NextResponse } from 'next/server';
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


type SleepVitalRow = {
  id?: string;
  type?: string;
  value?: number | string | null;
  valueNum?: number | string | null;
  payload?: Record<string, any> | null;
  recorded_at?: string | null;
  createdAt?: string | null;
  ts?: string | null;
  meta?: Record<string, any> | null;
};

function sleepToNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function sleepClamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function sleepSafeIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sleepIsoFromEpochish(v: unknown): string | null {
  const n = sleepToNum(v);
  if (typeof n === 'number') {
    const ms = n < 10_000_000_000 ? n * 1000 : n;
    return sleepSafeIso(ms);
  }
  return sleepSafeIso(v);
}

function sleepPickTs(row: SleepVitalRow): string | null {
  return sleepSafeIso(row.recorded_at) || sleepSafeIso(row.ts) || sleepSafeIso(row.createdAt);
}

function sleepDateFromTs(ts: string | null): string {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function sleepStageMinutes(payload: Record<string, any>, stage: 'deep' | 'rem' | 'light' | 'awake') {
  const direct =
    sleepToNum(payload?.stagesMin?.[stage]) ??
    sleepToNum(payload?.stages?.[stage]) ??
    sleepToNum(payload?.[stage]) ??
    sleepToNum(payload?.[`${stage}Minutes`]);

  if (typeof direct === 'number') return direct;

  const hours = sleepToNum(payload?.[`${stage}_hours`]);
  return typeof hours === 'number' ? Math.round(hours * 60) : 0;
}

function sleepQualityLabel(score: number) {
  if (score >= 80) return 'Restorative';
  if (score >= 65) return 'Fair';
  if (score >= 45) return 'Light';
  return 'Fragmented';
}

function sleepQualityFromStages(stages: SleepStages, hrv: number, directScore?: number): number {
  if (typeof directScore === 'number') return sleepClamp(Math.round(directScore), 0, 100);

  const total = stages.deep + stages.rem + stages.light + stages.awake;
  if (total <= 0) return 0;

  const sleepMinutes = stages.deep + stages.rem + stages.light;
  const efficiency = sleepMinutes / Math.max(1, total);

  const stageScore =
    efficiency * 55 +
    sleepClamp(stages.deep / Math.max(1, sleepMinutes), 0, 0.35) * 80 +
    sleepClamp(stages.rem / Math.max(1, sleepMinutes), 0, 0.3) * 70 +
    sleepClamp(hrv, 20, 90) * 0.25;

  return sleepClamp(Math.round(stageScore), 0, 100);
}

async function fetchSleepVitalsForType(
  origin: string,
  patientId: string,
  type: string,
  from: string,
  to: string,
): Promise<SleepVitalRow[]> {
  const qs = new URLSearchParams({ type, from, to });
  const url = `${origin}/api/v1/patients/${encodeURIComponent(patientId)}/vitals?${qs.toString()}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];

  const json = await res.json().catch(() => ({ items: [] }));
  return Array.isArray(json?.items) ? json.items : [];
}

function latestByDate(rows: SleepVitalRow[], valuePicker: (row: SleepVitalRow) => number | undefined) {
  const map = new Map<string, { ts: string | null; value: number; row: SleepVitalRow }>();

  for (const row of rows) {
    const ts = sleepPickTs(row);
    const date = sleepDateFromTs(ts);
    const value = valuePicker(row);
    if (typeof value !== 'number') continue;

    const prev = map.get(date);
    if (!prev || String(ts || '').localeCompare(String(prev.ts || '')) >= 0) {
      map.set(date, { ts, value, row });
    }
  }

  return map;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const patientId = url.searchParams.get('patientId') || '';
  const range = (url.searchParams.get('range') || '30d') as RangeKey;

  if (!patientId) {
    return NextResponse.json(
      { ok: false, error: 'patient_required', range, generatedAtISO: new Date().toISOString(), nights: [] },
      { status: 400 },
    );
  }

  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - (days - 1));

  const from = fromDate.toISOString();
  const to = now.toISOString();

  const [sleepRows, sleepScoreRows, hrvRows, rrRows, nightSpo2Rows, readinessRows] = await Promise.all([
    fetchSleepVitalsForType(url.origin, patientId, 'sleep', from, to),
    fetchSleepVitalsForType(url.origin, patientId, 'sleep_score', from, to),
    fetchSleepVitalsForType(url.origin, patientId, 'hrv', from, to),
    fetchSleepVitalsForType(url.origin, patientId, 'respiratory_rate', from, to),
    fetchSleepVitalsForType(url.origin, patientId, 'night_spo2', from, to),
    fetchSleepVitalsForType(url.origin, patientId, 'readiness', from, to),
  ]);

  const scoreByDate = latestByDate(
    sleepScoreRows,
    (row) => sleepToNum(row.payload?.score ?? row.payload?.sleepScore ?? row.payload?.value ?? row.valueNum ?? row.value),
  );

  const hrvByDate = latestByDate(
    hrvRows,
    (row) => sleepToNum(row.payload?.ms ?? row.payload?.hrv ?? row.payload?.avgHrv ?? row.payload?.value ?? row.valueNum ?? row.value),
  );

  const nights = sleepRows
    .map((row) => {
      const payload = row.payload || {};
      const ts = sleepPickTs(row);
      const dateISO = sleepDateFromTs(ts);

      const stagesMin: SleepStages = {
        deep: sleepStageMinutes(payload, 'deep'),
        rem: sleepStageMinutes(payload, 'rem'),
        light: sleepStageMinutes(payload, 'light'),
        awake: sleepStageMinutes(payload, 'awake'),
      };

      const explicitTotal =
        sleepToNum(payload?.total_minutes) ??
        sleepToNum(payload?.totalMinutes) ??
        (typeof sleepToNum(payload?.total_hours) === 'number'
          ? Math.round(sleepToNum(payload?.total_hours)! * 60)
          : undefined);

      if (explicitTotal && stagesMin.deep + stagesMin.rem + stagesMin.light <= 0) {
        stagesMin.light = explicitTotal;
      }

      const wakeISO =
        sleepIsoFromEpochish(payload?.endTs ?? payload?.end_ts ?? payload?.wakeISO) ||
        ts ||
        new Date().toISOString();

      const sleepMinutes = stagesMin.deep + stagesMin.rem + stagesMin.light;
      const totalMinutes = sleepMinutes + stagesMin.awake;
      const bedtimeISO =
        sleepIsoFromEpochish(payload?.startTs ?? payload?.start_ts ?? payload?.bedtimeISO) ||
        new Date(new Date(wakeISO).getTime() - Math.max(sleepMinutes, 1) * 60000).toISOString();

      const hrv = hrvByDate.get(dateISO)?.value ?? sleepToNum(payload?.hrv) ?? 0;
      const directScore =
        scoreByDate.get(dateISO)?.value ??
        sleepToNum(payload?.score ?? payload?.sleepScore ?? payload?.qualityScore);

      const qualityScore = sleepQualityFromStages(stagesMin, hrv || 50, directScore);
      const efficiency =
        totalMinutes > 0 ? sleepClamp(Math.round((sleepMinutes / totalMinutes) * 100), 0, 100) : 0;

      return {
        dateISO,
        bedtimeISO,
        wakeISO,
        stagesMin,
        hrv,
        efficiency,
        qualityScore,
        qualityLabel: sleepQualityLabel(qualityScore),
        note: null,
      };
    })
    .filter((night) => night.stagesMin.deep + night.stagesMin.rem + night.stagesMin.light > 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const latestNight = nights[nights.length - 1] || null;
  const avgQuality = nights.length
    ? Math.round(nights.reduce((sum, n) => sum + n.qualityScore, 0) / nights.length)
    : null;

  const response = {
    ok: true,
    patientId,
    userId: patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    nights,
    insights: {
      headline: nights.length
        ? `Sleep report is using persisted wearable sleep data across ${nights.length} night(s).`
        : 'No persisted sleep nights are available for this range yet.',
      highlights: [
        {
          title: 'Persisted sleep stages',
          detail: 'Sleep duration and stage data are read from the shared wearable vitals stream.',
        },
        {
          title: 'Recovery context',
          detail: 'HRV, respiratory rate, readiness and night SpO₂ sources are checked alongside sleep where available.',
        },
      ],
      recommendations: [
        {
          title: 'Sync after waking',
          detail: 'Open NexRing and use Sync ring after sleep so overnight history can populate this report.',
        },
      ],
    },
    sources: {
      sleep: {
        source: sleepRows.length ? 'patient_vitals_sleep_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: false,
      },
      sleep_score: {
        source: sleepScoreRows.length ? 'patient_vitals_sleep_score_read_model' : 'derived_from_sleep_stages',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: !sleepScoreRows.length,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: false,
      },
      respiratory_rate: {
        source: rrRows.length ? 'patient_vitals_respiratory_rate_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: false,
      },
      night_spo2: {
        source: nightSpo2Rows.length ? 'patient_vitals_night_spo2_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: false,
      },
      readiness: {
        source: readinessRows.length ? 'patient_vitals_readiness_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? null,
        inferred: false,
      },
    },
    summary: {
      avgQualityScore: avgQuality,
      nights: nights.length,
      sampleCounts: {
        sleep: sleepRows.length,
        sleepScore: sleepScoreRows.length,
        hrv: hrvRows.length,
        respiratoryRate: rrRows.length,
        nightSpo2: nightSpo2Rows.length,
        readiness: readinessRows.length,
      },
    },
  } as SleepReportResponse & { summary: Record<string, unknown> };

  return NextResponse.json(response);
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