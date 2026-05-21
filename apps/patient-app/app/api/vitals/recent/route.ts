// apps/patient-app/app/api/vitals/recent/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function labelForType(type: string) {
  if (type === 'blood_pressure') return 'Blood Pressure';
  if (type === 'spo2') return 'SpO₂';
  if (type === 'temperature') return 'Temperature';
  if (type === 'blood_glucose' || type === 'glucose') return 'Glucose';
  if (type === 'heart_rate') return 'Heart Rate';
  if (type === 'ecg') return 'ECG';
  return type.replace(/_/g, ' ');
}

function panelForType(type: string) {
  if (type === 'blood_pressure') return 'bp';
  if (type === 'spo2') return 'spo2';
  if (type === 'temperature') return 'temp';
  if (type === 'blood_glucose' || type === 'glucose') return 'glu';
  if (type === 'heart_rate') return 'hr';
  return type;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const res = await fetch(`${url.origin}/api/reports/vitals`, {
    cache: 'no-store',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!res?.ok) return json({ ok: false, error: 'recent_vitals_unavailable', items: [] }, 503);

  const report = await res.json().catch(() => null);
  const trend = Array.isArray(report?.trend) ? report.trend : [];

  const items = trend
    .flatMap((point: any) => {
      const ts = String(point.ts || '');
      const next: Array<{ timestamp: string; type: string; panel: string; label: string }> = [];

      for (const type of ['blood_pressure', 'spo2', 'temperature', 'blood_glucose', 'heart_rate']) {
        const hasValue =
          (type === 'blood_pressure' && (point.sys != null || point.dia != null)) ||
          (type === 'spo2' && point.spo2 != null) ||
          (type === 'temperature' && point.temp_c != null) ||
          (type === 'blood_glucose' && point.glucose != null) ||
          (type === 'heart_rate' && point.hr != null);

        if (ts && hasValue) {
          next.push({
            timestamp: ts,
            type,
            panel: panelForType(type),
            label: labelForType(type),
          });
        }
      }

      return next;
    })
    .sort((a: any, b: any) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 20);

  return json({ ok: true, items });
}
