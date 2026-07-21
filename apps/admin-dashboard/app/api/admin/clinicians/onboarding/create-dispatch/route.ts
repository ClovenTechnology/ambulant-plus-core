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
  const notifyClinician = body?.notifyClinician !== false;

  if (!clinicianId || !onboardingId || !courierName) {
    return new Response('clinicianId, onboardingId, courierName required', { status: 400 });
  }
  // 1) Create dispatch in gateway
  const res = await forwardToGateway(req, '/api/admin/clinicians/onboarding/create-dispatch', {
    clinicianId,
    onboardingId,
    courier: courierName,
    courierName,
    trackingCode,
    trackingUrl,
    dispatchKind: 'starter_kit',
    notifyClinician,
  });

  if (!res.ok) {
    return res;
  }

  const payload =
    await res
      .clone()
      .json()
      .catch(() => null);

  const responseBody =
    payload &&
    typeof payload === 'object'
      ? payload
      : {
          ok: true,
        };

  const newlyReleasedItems =
    Array.isArray(
      payload?.entitlements
        ?.newlyReleasedItems,
    )
      ? payload
          .entitlements
          .newlyReleasedItems
      : [];

  const authorisedItems =
    Array.isArray(
      payload?.entitlements
        ?.authorisedItems,
    )
      ? payload
          .entitlements
          .authorisedItems
      : [];

  const authoritativeKitItems =
    newlyReleasedItems.length
      ? newlyReleasedItems
      : authorisedItems;

  if (
    notifyClinician &&
    (
      trackingUrl ||
      trackingCode
    )
  ) {
    const notify =
      await bestEffortNotifyDispatch({
        clinicianId,
        onboardingId,
        courierName,
        trackingCode,
        trackingUrl,
        kitItems:
          authoritativeKitItems.length
            ? authoritativeKitItems
            : undefined,
        dispatchKind:
          'starter_kit',
        idempotencyKey:
          'dispatch:' +
          clinicianId +
          ':' +
          (
            trackingCode ||
            trackingUrl ||
            'no_tracking'
          ),
      });

    return NextResponse.json(
      {
        ...responseBody,
        notify,
      },
      {
        status: res.status,
      },
    );
  }

  return res;
}
