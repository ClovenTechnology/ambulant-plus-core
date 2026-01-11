//apps/admin-dashboard/app/api/admin/clinicians/onboarding/create-dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardToGateway, bestEffortNotifyDispatch } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const onboardingId = body?.onboardingId ? String(body.onboardingId) : '';
  const courierName = body?.courierName ? String(body.courierName) : '';
  const trackingCode = body?.trackingCode ? String(body.trackingCode) : null;
  const trackingUrl = body?.trackingUrl ? String(body.trackingUrl) : null;
  const kitItems = Array.isArray(body?.kitItems) ? body.kitItems.map(String) : [];
  const notifyClinician = body?.notifyClinician !== false;

  if (!clinicianId || !onboardingId || !courierName) {
    return new Response('clinicianId, onboardingId, courierName required', { status: 400 });
  }
  if (!kitItems.length) {
    return new Response('kitItems required', { status: 400 });
  }

  // 1) Create dispatch in gateway
  const res = await forwardToGateway(req, '/api/admin/clinicians/onboarding/create-dispatch', {
    clinicianId,
    onboardingId,
    courierName,
    trackingCode,
    trackingUrl,
    kitItems,
  });

  // If gateway failed, forwardToGateway already returns JSON response
  // We need to detect that and return early.
  // forwardToGateway returns a NextResponse; check status by cloning.
  const status = (res as any)?.status ?? 200;
  if (status !== 200) return res;

  // 2) Bulletproof notification: only attempt if requested AND tracking exists.
  if (notifyClinician && (trackingUrl || trackingCode)) {
    const notify = await bestEffortNotifyDispatch({
      clinicianId,
      onboardingId,
      courierName,
      trackingCode,
      trackingUrl,
      kitItems,
      // idempotency hint: gateway can use these to de-dupe
      idempotencyKey: `dispatch:${clinicianId}:${trackingCode || trackingUrl || 'no_tracking'}`,
    });

    // Never break the main save if notify fails.
    return NextResponse.json({ ok: true, notify }, { status: 200 });
  }

  return res;
}
