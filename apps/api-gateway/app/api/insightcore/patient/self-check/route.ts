// apps/api-gateway/app/api/insightcore/patient/self-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestPipeline } from '@/src/insightcore/ingestPipeline';
import { ResponseContractAssembler } from '@/src/insightcore/ResponseContractAssembler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      degradedMode: false,
      source: 'insightcore',
    },
    { status },
  );
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredId(value: unknown, name: string): string {
  const id = cleanString(value);
  if (!id) {
    throw Object.assign(new Error(`${name}_required`), { status: 400 });
  }

  return id;
}

function optionalId(value: unknown): string | null {
  const id = cleanString(value);
  return id || null;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

function toCurrentVitals(vitals: any[] = []) {
  const byKey = new Map(
    Array.isArray(vitals)
      ? vitals.map((v) => [String(v?.key || '').trim(), v])
      : [],
  );

  const bp = String(byKey.get('bp')?.value || '');
  const [sysRaw, diaRaw] = bp.includes('/')
    ? bp.split('/').map((x) => Number(x.trim()))
    : [undefined, undefined];

  return {
    heartRate: numberOrUndefined(byKey.get('hr')?.value),
    spo2: numberOrUndefined(byKey.get('spo2')?.value),
    temperature: numberOrUndefined(byKey.get('temp')?.value),
    systolic: Number.isFinite(sysRaw) ? sysRaw : undefined,
    diastolic: Number.isFinite(diaRaw) ? diaRaw : undefined,
    restingHr: numberOrUndefined(byKey.get('hr')?.value),
    sourceDevice: 'patient_self_check',
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return jsonError('invalid_json_body', 400);
  }

  try {
    const patientId = requiredId(
      body.patientId || body.meta?.patientId || req.headers.get('x-patient-id'),
      'patientId',
    );

    const orgId = requiredId(
      body.orgId || req.headers.get('x-org-id'),
      'orgId',
    );

    const clinicianId = optionalId(body.clinicianId || req.headers.get('x-clinician-id'));
    const encounterId = optionalId(body.encounterId || body.meta?.encounterId);

    const result = await ingestPipeline({
      patientId,
      orgId,
      clinicianId,
      encounterId,
      currentVitals: toCurrentVitals(body.vitals || []),
      previousVitals: null,
      lifestyle: {
        sleepHours: body.meta?.wearableDrivers?.sleepHours ?? null,
      },
    });

    const patient = new ResponseContractAssembler().toPatient({
      requestId: result.requestId,
      degradedMode: false,
      source: 'insightcore',
      local: null,
      result,
      baselineTrend: result.baselineTrend,
      baselineState: result.baselineState,
    });

    return NextResponse.json(patient);
  } catch (err: any) {
    return jsonError(err?.message || 'self_check_insight_failed', err?.status || 500);
  }
}