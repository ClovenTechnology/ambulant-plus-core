// apps/patient-app/app/api/plan/pay-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  PLAN_COOKIE,
  normalizePlan,
  type Plan,
} from '../../../../lib/plans';
import {
  PatientPlanWriterError,
  purchasePatientPlanWithWallet,
} from '../../../../lib/patient-plan-writer.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatientSession = {
  userId: string;
  patientId: string;
};

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

  const json =
    await response.json().catch(() => null);

  if (!json || json.ok === false) {
    return null;
  }

  const actorType =
    String(
      json.actorType ??
        json.user?.actorType ??
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
      json.userId ??
        json.uid ??
        json.id ??
        json.user?.userId ??
        json.user?.uid ??
        json.user?.id ??
        '',
    ).trim();

  const patientId =
    String(
      json.patientId ??
        json.profile?.patientId ??
        json.profile?.id ??
        json.user?.patientId ??
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
): 'monthly' | 'annual' {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'annual'
    ? 'annual'
    : 'monthly';
}

export async function POST(
  req: NextRequest,
) {
  const subject =
    await authenticatedPatient(req);

  if (!subject) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'patient_authentication_required',
      },
      { status: 401 },
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

  const cycle =
    normalizeCycle(
      body?.cycle,
    );

  if (!plan || plan === 'free') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid plan.',
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await purchasePatientPlanWithWallet({
        userId: subject.userId,
        patientId: subject.patientId,
        plan,
        cycle,
        txRef: body?.tx,
      });

    const response =
      NextResponse.json({
        ok: true,
        ...result,
      });

    // Transitional compatibility only.
    // Durable entitlement state is authoritative.
    response.cookies.set(
      PLAN_COOKIE,
      result.plan,
      {
        path: '/',
        maxAge:
          60 * 60 * 24 * 365,
        sameSite: 'lax',
      },
    );

    return response;
  } catch (error) {
    if (
      error instanceof
        PatientPlanWriterError
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message ||
            error.code,
          code: error.code,
        },
        {
          status: error.status,
        },
      );
    }

    console.error(
      'plan_pay_wallet_failed',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'plan_wallet_purchase_failed',
      },
      { status: 500 },
    );
  }
}