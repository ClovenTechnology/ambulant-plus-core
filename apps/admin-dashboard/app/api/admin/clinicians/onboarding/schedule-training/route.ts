//apps/admin-dashboard/app/api/admin/clinicians/onboarding/schedule-training/route.ts
import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicians = Array.isArray(body?.clinicians)
    ? body.clinicians
        .map((x: any) => ({
          clinicianId: x?.clinicianId ? String(x.clinicianId) : '',
          onboardingId: x?.onboardingId ? String(x.onboardingId) : '',
        }))
        .filter((x: any) => x.clinicianId && x.onboardingId)
    : [];

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const onboardingId = body?.onboardingId ? String(body.onboardingId) : '';
  const startAt = body?.startAt ? String(body.startAt) : '';
  const endAt = body?.endAt ? String(body.endAt) : '';
  const mode = body?.mode === 'in_person' ? 'in_person' : 'virtual';
  const joinUrl = body?.joinUrl ? String(body.joinUrl) : null;
  const trainerName = body?.trainerName ? String(body.trainerName) : null;
  const title = body?.title ? String(body.title) : null;
  const summary = body?.summary ? String(body.summary) : null;

  if ((!clinicians.length && (!clinicianId || !onboardingId)) || !startAt || !endAt) {
    return new Response('clinicians, startAt, endAt required', { status: 400 });
  }

  return forwardToGateway(req, '/api/admin/clinicians/onboarding/schedule-training', {
    clinicians: clinicians.length ? clinicians : undefined,
    clinicianId: clinicians.length ? undefined : clinicianId,
    onboardingId: clinicians.length ? undefined : onboardingId,
    startAt,
    endAt,
    mode,
    joinUrl,
    trainerName,
    title,
    summary,
  });
}
