// apps/patient-app/app/api/reminder-push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';

type RawPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type GatewayPatient = {
  id?: string;
  patientId?: string;
};

async function resolvePatientIdForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  // Mirror apps/patient-app/app/api/profile/route.ts
  if (!API) {
    // Local dev fallback – keep null so backend can decide
    return null;
  }

  try {
    const r = await fetch(
      `${API}/patient/profile?userId=${encodeURIComponent(userId)}`,
      {
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
      }
    );

    if (!r.ok) return null;

    const data = await r.json().catch(() => ({} as any));
    const patient: GatewayPatient = (data?.patient || data?.profile || data || {}) as GatewayPatient;

    // Prefer `id`, fall back to `patientId`
    return patient?.id || patient?.patientId || null;
  } catch (err) {
    console.error('[reminder-push/subscribe] Failed to resolve patientId from API', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.subscription) {
      return NextResponse.json(
        { ok: false, error: 'Missing subscription payload.' },
        { status: 400 }
      );
    }

    const subscription = body.subscription as RawPushSubscription;

    if (
      !subscription.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { ok: false, error: 'Invalid subscription shape.' },
        { status: 400 }
      );
    }

    // Try to determine the current user -> patient
    const url = new URL(req.url);
    const urlUserId = url.searchParams.get('userId');
    const bodyUserId = typeof body.userId === 'string' ? body.userId : null;
    const userId = bodyUserId || urlUserId || null;

    const patientId = await resolvePatientIdForUser(userId);

    const userAgent = req.headers.get('user-agent') ?? null;

    // At this layer (patient-app), we usually *forward* to the API gateway
    // so Prisma/DB access stays in apps/api-gateway.
    //
    if (API) {
      try {
        const gatewayRes = await fetch(`${API}/reminder-push/subscribe`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            patientId,
            subscription,
            userAgent,
          }),
        });

        if (!gatewayRes.ok) {
          const errText = await gatewayRes.text().catch(() => '');
          console.error('[reminder-push/subscribe] Gateway error:', errText);
          return NextResponse.json(
            { ok: false, error: 'Failed to persist push subscription.' },
            { status: 502 }
          );
        }
      } catch (err) {
        console.error(
          '[reminder-push/subscribe] Error calling API gateway /reminder-push/subscribe',
          err
        );
        return NextResponse.json(
          { ok: false, error: 'Failed to persist push subscription.' },
          { status: 502 }
        );
      }
    } else {
      // If no API is configured, you *could* use Prisma directly here instead.
      // Example (in apps with a local Prisma client):
      //
      // await prisma.reminderPushSubscription.upsert({
      //   where: { endpoint: subscription.endpoint },
      //   create: {
      //     patientId,
      //     endpoint: subscription.endpoint,
      //     p256dh: subscription.keys.p256dh,
      //     auth: subscription.keys.auth,
      //     userAgent,
      //   },
      //   update: {
      //     p256dh: subscription.keys.p256dh,
      //     auth: subscription.keys.auth,
      //     updatedAt: new Date(),
      //   },
      // });
    }

    console.log('[reminder-push/subscribe] Stored subscription', {
      userId,
      patientId,
      endpoint: subscription.endpoint,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reminder-push/subscribe] Error', err);
    return NextResponse.json(
      { ok: false, error: 'Internal error subscribing to push.' },
      { status: 500 }
    );
  }
}
