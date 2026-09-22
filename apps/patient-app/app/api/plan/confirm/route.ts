// apps/patient-app/app/api/plan/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { Plan } from '../../../../lib/plans';
import { normalizePlan } from '../../../../lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BillingCycle = 'monthly' | 'annual';

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

function normalizeCycle(
  value: unknown,
): BillingCycle {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'annual'
    ? 'annual'
    : 'monthly';
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
    await req.json().catch(
      () => ({} as any),
    );

  const plan =
    normalizePlan(
      body?.plan,
    ) as Plan | null;

  const tx =
    String(body?.tx ?? '')
      .trim()
      .slice(0, 180);

  const cycle =
    normalizeCycle(
      body?.cycle,
    );

  if (!tx) {
    return json(
      {
        ok: false,
        error:
          'missing_transaction_id',
      },
      400,
    );
  }

  if (!plan || plan === 'free') {
    return json(
      {
        ok: false,
        error: 'invalid_paid_plan',
      },
      400,
    );
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
          'Paid-plan activation requires verified server-side payment evidence.',
      },
      409,
    );
  }

  // Explicit non-production compatibility only.
  // This does not persist entitlement state and does not set plan cookies.
  return json({
    ok: true,
    simulated: true,
    authoritative: false,
    subject: {
      patientId: subject.patientId,
    },
    transaction: {
      reference: tx,
      plan,
      cycle,
    },
    message:
      'Non-production payment simulation accepted. No durable entitlement was written.',
  });
}