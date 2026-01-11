//apps/admin-dashboard/app/api/admin/clinicians/onboarding/cancel-training/route.ts
import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const onboardingId = body?.onboardingId ? String(body.onboardingId) : '';
  const trainingSlotId = body?.trainingSlotId ? String(body.trainingSlotId) : '';

  if (!clinicianId || !onboardingId || !trainingSlotId) {
    return new Response('clinicianId, onboardingId, trainingSlotId required', { status: 400 });
  }

  return forwardToGateway(req, '/api/admin/clinicians/onboarding/cancel-training', {
    clinicianId,
    onboardingId,
    trainingSlotId,
  });
}
