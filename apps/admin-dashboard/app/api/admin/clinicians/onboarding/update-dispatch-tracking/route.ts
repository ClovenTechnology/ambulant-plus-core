//apps/admin-dashboard/app/api/admin/clinicians/onboarding/update-dispatch-tracking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardToGateway, bestEffortNotifyDispatch } from '../_helpers';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = body?.clinicianId ? String(body.clinicianId) : '';
  const dispatchId = body?.dispatchId ? String(body.dispatchId) : '';
  const courierName = body?.courierName ? String(body.courierName) : '';
  const trackingCode = body?.trackingCode ? String(body.trackingCode) : null;
  const trackingUrl = body?.trackingUrl ? String(body.trackingUrl) : null;
  const kitItems = Array.isArray(body?.kitItems) ? body.kitItems.map(String) : [];
  const notifyClinician = body?.notifyClinician !== false;

  if (!clinicianId || !dispatchId || !courierName) {
    return new Response('clinicianId, dispatchId, courierName required', { status: 400 });
  }
  if (!trackingCode && !trackingUrl) {
    return new Response('trackingCode or trackingUrl required', { status: 400 });
  }

  // 1) Update in gateway
  const res = await forwardToGateway(req, '/api/admin/clinicians/onboarding/update-dispatch-tracking', {
    clinicianId,
    dispatchId,
    courierName,
    trackingCode,
    trackingUrl,
  });

  const status = (res as any)?.status ?? 200;
  if (status !== 200) return res;

  // 2) Auto notify clinician (bulletproof, best-effort)
  if (notifyClinician) {
    const notify = await bestEffortNotifyDispatch({
      clinicianId,
      dispatchId,
      courierName,
      trackingCode,
      trackingUrl,
      kitItems: kitItems.length ? kitItems : undefined,
      idempotencyKey: `dispatch_tracking:${dispatchId}:${trackingCode || trackingUrl || 'no_tracking'}`,
    });

    return NextResponse.json({ ok: true, notify }, { status: 200 });
  }

  return res;
}
