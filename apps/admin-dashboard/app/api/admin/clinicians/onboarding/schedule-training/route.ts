//apps/admin-dashboard/app/api/admin/clinicians/onboarding/schedule-training/route.ts
import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const onboardingId = body?.onboardingId ? String(body.onboardingId) : '';
  const startAt = body?.startAt ? String(body.startAt) : '';
  const endAt = body?.endAt ? String(body.endAt) : '';
  const mode = body?.mode === 'in_person' ? 'in_person' : 'virtual';
  const joinUrl = body?.joinUrl ? String(body.joinUrl) : null;

  if (!clinicianId || !onboardingId || !startAt || !endAt) {
    return new Response('clinicianId, onboardingId, startAt, endAt required', { status: 400 });
  }
  if (mode === 'virtual' && !joinUrl) {
    return new Response('joinUrl required for virtual', { status: 400 });
  }

  return forwardToGateway(req, '/api/admin/clinicians/onboarding/schedule-training', {
    clinicianId,
    onboardingId,
    startAt,
    endAt,
    mode,
    joinUrl,
  });
}
