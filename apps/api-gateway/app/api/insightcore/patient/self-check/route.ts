import { NextRequest, NextResponse } from 'next/server';
import { ingestPipeline } from '@/src/insightcore/ingestPipeline';
import { ResponseContractAssembler } from '@/src/insightcore/ResponseContractAssembler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toCurrentVitals(vitals: any[] = []) {
  const byKey = new Map(vitals.map((v) => [v.key, v]));
  const bp = String(byKey.get('bp')?.value || '');
  const [sys, dia] = bp.includes('/') ? bp.split('/').map((x) => Number(x.trim())) : [undefined, undefined];

  return {
    heartRate: Number(byKey.get('hr')?.value ?? 0) || undefined,
    spo2: Number(byKey.get('spo2')?.value ?? 0) || undefined,
    temperature: Number(byKey.get('temp')?.value ?? 0) || undefined,
    systolic: Number.isFinite(sys) ? sys : undefined,
    diastolic: Number.isFinite(dia) ? dia : undefined,
    restingHr: Number(byKey.get('hr')?.value ?? 0) || undefined,
    sourceDevice: 'patient_self_check',
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  try {
    const result = await ingestPipeline({
      patientId: body.patientId || body.meta?.patientId || 'pt-selfcheck-demo',
      orgId: body.orgId || 'org-default',
      clinicianId: null,
      encounterId: null,
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
      local: {
        score: body.meta?.localScore ?? null,
        diagnoses: body.meta?.localDiagnoses ?? [],
        recommendations: body.meta?.localRecommendations ?? [],
        explanations: body.meta?.localExplanations ?? [],
        confidence: null,
      },
      result,
      baselineTrend: result.baselineTrend,
      baselineState: result.baselineState,
    });

    return NextResponse.json(patient);
  } catch {
    return NextResponse.json(
      {
        error: 'self_check_insight_failed',
        degradedMode: true,
      },
      { status: 500 },
    );
  }
}