import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardAdminSessionRequest } from '../../../../clinicians/onboarding/_helpers';

export const runtime = 'edge';
export async function POST(req: NextRequest, { params }: { params: { clinicianId: string } }) {
  const clinicianId = String(params.clinicianId || '').trim();
  if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId_required' }, { status: 400 });
  return forwardAdminSessionRequest(
    req,
    `/api/admin/simulation/clinicians/${encodeURIComponent(clinicianId)}/approve-real-patients`,
    { method: 'POST', body: await readJson(req) },
  );
}
