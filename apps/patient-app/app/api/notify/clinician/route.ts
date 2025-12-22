//apps/patient-app/app/api/notify/clinician/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notifyClinicianFCM } from '@/src/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TODO: replace with real DB lookup of clinician device tokens
async function getClinicianTokens(clinicianId: string): Promise<string[]> {
  // e.g., query prisma.devices where clinicianId = ...
  return process.env.DEMO_CLINICIAN_FCM_TOKEN ? [process.env.DEMO_CLINICIAN_FCM_TOKEN] : [];
}

export async function POST(req: NextRequest) {
  try {
    const { clinicianId, title, body, data } = await req.json().catch(() => ({}));
    if (!clinicianId || !title || !body) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const tokens = await getClinicianTokens(clinicianId);
    const res = await notifyClinicianFCM(tokens, title, body, Object.fromEntries(Object.entries(data || {}).map(([k,v]) => [k, String(v)])));
    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'notify_failed' }, { status: 500 });
  }
}
