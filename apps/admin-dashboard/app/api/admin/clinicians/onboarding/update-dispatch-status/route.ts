//apps/admin-dashboard/app/api/admin/clinicians/onboarding/update-dispatch-status/route.ts
import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const dispatchId = body?.dispatchId ? String(body.dispatchId) : '';
  const status = body?.status ? String(body.status) : '';

  if (!clinicianId || !dispatchId || !status) {
    return new Response('clinicianId, dispatchId, status required', { status: 400 });
  }

  return forwardToGateway(req, '/api/admin/clinicians/onboarding/update-dispatch-status', {
    clinicianId,
    dispatchId,
    status,
  });
}
