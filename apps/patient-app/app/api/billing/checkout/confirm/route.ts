// file: apps/patient-app/app/api/billing/checkout/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PremiumOffer =
  | 'bundle_40_free_year'
  | 'annual_premium_raffle';

type PatientSession = {
  userId: string;
  patientId: string;
};

function json(
  data: unknown,
  status = 200,
) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

async function authenticatedPatient(
  req: NextRequest,
): Promise<PatientSession | null> {
  const url =
    new URL('/api/auth/me', req.url);

  const response =
    await fetch(url, {
      method: 'GET',
      headers: {
        cookie:
          req.headers.get('cookie') || '',
        authorization:
          req.headers.get('authorization') || '',
        accept: 'application/json',
      },
      cache: 'no-store',
    }).catch(() => null);

  if (!response?.ok) return null;

  const payload =
    await response.json().catch(() => null);

  if (!payload || payload.ok === false) {
    return null;
  }

  const actorType =
    String(
      payload.actorType ??
        payload.user?.actorType ??
        '',
    )
      .trim()
      .toUpperCase();

  if (
    actorType &&
    actorType !== 'PATIENT'
  ) {
    return null;
  }

  const userId =
    String(
      payload.userId ??
        payload.uid ??
        payload.id ??
        payload.user?.userId ??
        payload.user?.uid ??
        payload.user?.id ??
        '',
    ).trim();

  const patientId =
    String(
      payload.patientId ??
        payload.profile?.patientId ??
        payload.profile?.id ??
        payload.user?.patientId ??
        '',
    ).trim();

  if (!userId || !patientId) {
    return null;
  }

  return {
    userId,
    patientId,
  };
}

function paymentSimulatorEnabled() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_PATIENT_PAYMENT_SIMULATOR === 'true'
  );
}

export async function POST(
  req: NextRequest,
) {
  const subject =
    await authenticatedPatient(req);

  if (!subject) {
    return json(
      {
        ok: false,
        error:
          'patient_authentication_required',
      },
      401,
    );
  }

  const body =
    (await req.json().catch(
      () => null,
    )) as any;

  if (!body) {
    return json(
      {
        ok: false,
        error: 'invalid_json_payload',
      },
      400,
    );
  }

  const orderId =
    String(body?.orderId || '')
      .trim()
      .slice(0, 180);

  const status =
    String(body?.status || '')
      .trim()
      .toLowerCase();

  const offer =
    String(
      body?.offer || '',
    ) as PremiumOffer;

  if (!orderId) {
    return json(
      {
        ok: false,
        error: 'missing_order_id',
      },
      400,
    );
  }

  if (
    status !== 'success' &&
    status !== 'cancel'
  ) {
    return json(
      {
        ok: false,
        error: 'invalid_status',
      },
      400,
    );
  }

  if (
    offer !== 'bundle_40_free_year' &&
    offer !== 'annual_premium_raffle'
  ) {
    return json(
      {
        ok: false,
        error: 'invalid_offer',
      },
      400,
    );
  }

  if (status === 'cancel') {
    return json({
      ok: true,
      orderId,
      offer,
      status: 'cancel',
      authoritative: false,
      patientId: subject.patientId,
      confirmedAt:
        new Date().toISOString(),
    });
  }

  if (!paymentSimulatorEnabled()) {
    return json(
      {
        ok: false,
        error:
          'verified_payment_required',
        code:
          'verified_payment_required',
        message:
          'Checkout success cannot be confirmed from browser input. Provider-verified payment evidence is required.',
      },
      409,
    );
  }

  // Explicit non-production compatibility only.
  // This does not write a payment record or entitlement.
  return json({
    ok: true,
    orderId,
    offer,
    status: 'success',
    simulated: true,
    authoritative: false,
    patientId: subject.patientId,
    confirmedAt:
      new Date().toISOString(),
    message:
      'Non-production payment simulation accepted. No durable payment or entitlement was written.',
  });
}