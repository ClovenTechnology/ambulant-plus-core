import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  type PatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type ExportSections = {
  bp?: boolean;
  sleep?: boolean;
  stress?: boolean;
  fertility?: boolean;
};

type Body = {
  patientId?: string;
  range?: RangeKey;
  sections?: ExportSections;
  signOff?: boolean;
  clinicianName?: string;
};

type SleepStages = {
  rem: number;
  deep: number;
  light: number;
  awake: number;
};

type SleepVitalRow = {
  value?: number | string | null;
  valueNum?: number | string | null;
  payload?: Record<string, any> | null;
  recorded_at?: string | null;
  createdAt?: string | null;
  ts?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  meta: { color: '#475569', marginBottom: 10 },
  section: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stat: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 7,
    flexGrow: 1,
    flexBasis: 0,
  },
  label: { fontSize: 8, color: '#64748b' },
  value: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  body: { color: '#334155', marginTop: 4 },
  sign: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
});

function parseRange(value: string | null | undefined): RangeKey {
  return value === '7d' || value === '90d' || value === '1y' ? value : '30d';
}

function rangeDays(range: RangeKey) {
  if (range === '7d') return 7;
  if (range === '90d') return 90;
  if (range === '1y') return 365;
  return 30;
}

function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function safeIso(value: unknown): string | null {
  if (!value) return null;
  const numeric = toNum(value);
  const candidate =
    typeof numeric === 'number'
      ? numeric < 10_000_000_000
        ? numeric * 1000
        : numeric
      : value;
  const d = new Date(candidate as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function rowTs(row: SleepVitalRow) {
  return safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
}

function dateFromRow(row: SleepVitalRow) {
  return rowTs(row)?.slice(0, 10) ?? null;
}

function stageMinutes(
  payload: Record<string, any>,
  stage: 'deep' | 'rem' | 'light' | 'awake',
): number {
  const direct =
    toNum(payload?.stagesMin?.[stage]) ??
    toNum(payload?.stages?.[stage]) ??
    toNum(payload?.[stage]) ??
    toNum(payload?.[`${stage}Minutes`]);

  if (typeof direct === 'number') return Math.max(0, direct);

  const hours = toNum(payload?.[`${stage}_hours`]);
  return typeof hours === 'number' ? Math.max(0, Math.round(hours * 60)) : 0;
}

function directTotalMinutes(payload: Record<string, any>, stages: SleepStages): number | null {
  const explicit =
    toNum(payload?.total_minutes) ??
    toNum(payload?.totalMinutes) ??
    (typeof toNum(payload?.total_hours) === 'number'
      ? toNum(payload?.total_hours)! * 60
      : undefined);

  if (typeof explicit === 'number' && explicit >= 0) return Math.round(explicit);

  const staged = stages.deep + stages.rem + stages.light + stages.awake;
  return staged > 0 ? Math.round(staged) : null;
}

function directEfficiency(payload: Record<string, any>): number | null {
  const value = toNum(payload?.efficiency ?? payload?.sleepEfficiency);
  if (typeof value !== 'number') return null;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
}

async function fetchVitalsForType(
  req: NextRequest,
  identity: PatientGatewayIdentity,
  type: string,
  from: string,
  to: string,
): Promise<SleepVitalRow[]> {
  const qs = new URLSearchParams({ type, from, to });
  const url = `${req.nextUrl.origin}/api/v1/patients/${encodeURIComponent(identity.patientId)}/vitals?${qs.toString()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: patientGatewayHeaders({ req, identity }),
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({ items: [] }));
  return Array.isArray(json?.items) ? json.items : [];
}

function latestValueByDate(
  rows: SleepVitalRow[],
  picker: (row: SleepVitalRow) => number | undefined,
) {
  const map = new Map<string, { value: number; ts: string | null }>();
  for (const row of rows) {
    const date = dateFromRow(row);
    if (!date) continue;
    const value = picker(row);
    if (typeof value !== 'number') continue;
    const ts = rowTs(row);
    const prev = map.get(date);
    if (!prev || String(ts || '').localeCompare(String(prev.ts || '')) >= 0) {
      map.set(date, { value, ts });
    }
  }
  return map;
}

async function buildSleepResponse(
  req: NextRequest,
  identity: PatientGatewayIdentity,
  range: RangeKey,
) {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - (rangeDays(range) - 1));
  const from = fromDate.toISOString();
  const to = now.toISOString();

  // SR09 sleep-stage history is retained. Readiness, RHR and vendor sleep
  // scores are deliberately excluded until their semantics are verified.
  const [sleepRows, hrvRows, rrRows, nightSpo2Rows] = await Promise.all([
    fetchVitalsForType(req, identity, 'sleep', from, to),
    fetchVitalsForType(req, identity, 'hrv', from, to),
    fetchVitalsForType(req, identity, 'respiratory_rate', from, to),
    fetchVitalsForType(req, identity, 'night_spo2', from, to),
  ]);

  const hrvByDate = latestValueByDate(
    hrvRows,
    (row) =>
      toNum(
        row.payload?.ms ??
          row.payload?.hrv ??
          row.payload?.avgHrv ??
          row.payload?.value ??
          row.valueNum ??
          row.value,
      ),
  );

  const nights = sleepRows
    .map((row) => {
      const payload = row.payload || {};
      const dateISO = dateFromRow(row);
      if (!dateISO) return null;

      const stagesMin: SleepStages = {
        deep: stageMinutes(payload, 'deep'),
        rem: stageMinutes(payload, 'rem'),
        light: stageMinutes(payload, 'light'),
        awake: stageMinutes(payload, 'awake'),
      };

      const totalMinutes = directTotalMinutes(payload, stagesMin);
      if (totalMinutes === null) return null;

      const bedtimeISO = safeIso(
        payload?.startTs ?? payload?.start_ts ?? payload?.bedtimeISO,
      );
      const wakeISO = safeIso(
        payload?.endTs ?? payload?.end_ts ?? payload?.wakeISO,
      );

      return {
        dateISO,
        bedtimeISO,
        wakeISO,
        stagesMin,
        totalMinutes,
        hrv:
          hrvByDate.get(dateISO)?.value ??
          toNum(payload?.hrv ?? payload?.avgHrv) ??
          null,
        efficiency: directEfficiency(payload),
        qualityScore: null,
        qualityLabel: 'Unavailable',
        note: null,
      };
    })
    .filter((night): night is NonNullable<typeof night> => Boolean(night))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const latestNight = nights[nights.length - 1] ?? null;

  return {
    ok: true,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    inferenceMode: 'direct_sleep_history_only',
    nights,
    insights: {
      headline: nights.length
        ? `Persisted sleep history is available for ${nights.length} night(s).`
        : 'No persisted sleep history is available for this range.',
      highlights: [
        {
          title: 'No synthetic sleep score',
          detail:
            'Sleep stage and duration observations are shown without estimating sleep quality, readiness or resting heart rate.',
        },
      ],
      recommendations: [],
    },
    sources: {
      sleep: {
        source: sleepRows.length ? 'patient_vitals_sleep_read_model' : 'unavailable',
        recorded_at: latestNight?.wakeISO ?? rowTs(sleepRows[sleepRows.length - 1] || {}),
        inferred: false,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: rowTs(hrvRows[hrvRows.length - 1] || {}),
        inferred: false,
      },
      respiratory_rate: {
        source: rrRows.length ? 'patient_vitals_respiratory_rate_read_model' : 'unavailable',
        recorded_at: rowTs(rrRows[rrRows.length - 1] || {}),
        inferred: false,
      },
      night_spo2: {
        source: nightSpo2Rows.length ? 'patient_vitals_night_spo2_read_model' : 'unavailable',
        recorded_at: rowTs(nightSpo2Rows[nightSpo2Rows.length - 1] || {}),
        inferred: false,
      },
      sleep_score: { source: 'unavailable', recorded_at: null, inferred: false },
      readiness: { source: 'unavailable', recorded_at: null, inferred: false },
    },
    summary: {
      avgQualityScore: null,
      nights: nights.length,
      sampleCounts: {
        sleep: sleepRows.length,
        sleepScore: 0,
        hrv: hrvRows.length,
        respiratoryRate: rrRows.length,
        nightSpo2: nightSpo2Rows.length,
        readiness: 0,
      },
    },
  };
}

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { ok: false, error: 'patient_authentication_required', nights: [] },
      { status: 401 },
    );
  }

  const requestedPatientId = String(req.nextUrl.searchParams.get('patientId') || '').trim();
  if (requestedPatientId && requestedPatientId !== identity.patientId) {
    return NextResponse.json(
      { ok: false, error: 'patient_context_mismatch', nights: [] },
      { status: 403 },
    );
  }

  const range = parseRange(req.nextUrl.searchParams.get('range'));
  return NextResponse.json(await buildSleepResponse(req, identity, range));
}

function fmt(value: unknown, digits = 0) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n)
    : '—';
}

async function fetchInternalJson(
  req: NextRequest,
  identity: PatientGatewayIdentity,
  pathname: string,
  range: RangeKey,
) {
  try {
    const url = `${req.nextUrl.origin}${pathname}?range=${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: patientGatewayHeaders({ req, identity }),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

function supportedSections(sections?: ExportSections) {
  const selected = sections || {};
  const any = Boolean(selected.bp || selected.sleep || selected.stress || selected.fertility);
  return {
    all: !any,
    bp: Boolean(selected.bp),
    sleep: Boolean(selected.sleep),
    stress: Boolean(selected.stress),
    fertility: Boolean(selected.fertility),
  };
}

export async function POST(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return new Response('Authentication required', { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const requestedPatientId = String(body?.patientId || '').trim();
  if (requestedPatientId && requestedPatientId !== identity.patientId) {
    return new Response('Patient context mismatch', { status: 403 });
  }

  const range = parseRange(body?.range);
  const selected = supportedSections(body?.sections);
  const includeVitals = selected.all || selected.bp;
  const includeSleep = selected.all || selected.sleep;
  const includeStress = selected.all || selected.stress;
  const includeFertility = selected.all || selected.fertility;

  const [vitals, sleep, stress, fertility] = await Promise.all([
    includeVitals
      ? fetchInternalJson(req, identity, '/api/reports/vitals', range)
      : Promise.resolve(null),
    includeSleep
      ? Promise.resolve(await buildSleepResponse(req, identity, range))
      : Promise.resolve(null),
    includeStress
      ? fetchInternalJson(req, identity, '/api/reports/stress', range)
      : Promise.resolve(null),
    includeFertility
      ? fetchInternalJson(req, identity, '/api/reports/fertility', range)
      : Promise.resolve(null),
  ]);

  const nodes: React.ReactNode[] = [
    React.createElement(
      View,
      { key: 'header' },
      React.createElement(Text, { style: styles.h1 }, 'Ambulant+ Health Report'),
      React.createElement(
        Text,
        { style: styles.meta },
        `Range: ${range.toUpperCase()} • Generated: ${new Date().toLocaleString()}`,
      ),
    ),
  ];

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
                  React.createElement(Text, { style: styles.label }, 'Blood pressure'),
                  React.createElement(
                    Text,
                    { style: styles.value },
                    `${fmt(vitals.latest?.sys)}/${fmt(vitals.latest?.dia)} mmHg`,
                  ),
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.label }, 'Heart rate'),
                  React.createElement(Text, { style: styles.value }, `${fmt(vitals.latest?.hr)} bpm`),
                ),
                React.createElement(
                  View,
                  { style: styles.stat },
                  React.createElement(Text, { style: styles.label }, 'SpO2'),
                  React.createElement(Text, { style: styles.value }, `${fmt(vitals.latest?.spo2)} %`),
                ),
              ),
              React.createElement(
                Text,
                { style: styles.body },
                'Only persisted observations available to the authenticated patient context are included.',
              ),
            )
          : React.createElement(Text, { style: styles.body }, 'Vitals unavailable.'),
      ),
    );
  }

  if (includeSleep) {
    const latest = sleep?.nights?.[sleep.nights.length - 1];
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
                { style: styles.body },
                sleep.insights?.headline || 'Persisted sleep observations.',
              ),
              React.createElement(
                Text,
                { style: styles.body },
                `Latest recorded duration: ${latest?.totalMinutes == null ? '—' : `${fmt(latest.totalMinutes)} min`}`,
              ),
              React.createElement(
                Text,
                { style: styles.body },
                'Sleep quality/readiness scores are not estimated when their semantics are unverified.',
              ),
            )
          : React.createElement(Text, { style: styles.body }, 'Sleep observations unavailable.'),
      ),
    );
  }

  if (includeStress) {
    nodes.push(
      React.createElement(
        View,
        { key: 'stress', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Stress observations'),
        React.createElement(
          Text,
          { style: styles.body },
          stress?.insights?.headline || 'No direct persisted stress score is available.',
        ),
        React.createElement(
          Text,
          { style: styles.body },
          `Direct average stress score: ${fmt(stress?.summary?.avgStressIndex, 1)}`,
        ),
      ),
    );
  }

  if (includeFertility) {
    nodes.push(
      React.createElement(
        View,
        { key: 'fertility', style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Reproductive-health observations'),
        React.createElement(
          Text,
          { style: styles.body },
          fertility?.insights?.headline || 'No persisted observations are available.',
        ),
        React.createElement(
          Text,
          { style: styles.body },
          'This report does not infer cycle phase, ovulation or pregnancy from wearable physiology.',
        ),
      ),
    );
  }

  if (body?.signOff) {
    nodes.push(
      React.createElement(
        View,
        { key: 'sign', style: styles.sign },
        React.createElement(Text, null, `Clinician: ${body.clinicianName || '_________________________'}`),
        React.createElement(Text, null, 'Date: _______________________'),
        React.createElement(Text, null, 'Signature: ___________________'),
      ),
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
      'Content-Disposition': `attachment; filename="ambulant-health-report-${Date.now()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
