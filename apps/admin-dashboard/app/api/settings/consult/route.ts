// apps/admin-dashboard/app/api/settings/consult/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function numberFromBody(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalisePolicy(input: Record<string, any> = {}) {
  return {
    minStandardMinutes: numberFromBody(input.minStandardMinutes, 30),
    minFollowupMinutes: numberFromBody(input.minFollowupMinutes, 15),
    bufferAfterMinutes: numberFromBody(input.bufferAfterMinutes, 5),
    joinGracePatientMin: numberFromBody(input.joinGracePatientMin, 5),
    joinGraceClinicianMin: numberFromBody(input.joinGraceClinicianMin, 5),
    minCancel24hRefund: numberFromBody(input.minCancel24hRefund, 50),
    minNoShowRefund: numberFromBody(input.minNoShowRefund, 0),
    minClinicianMissRefund: numberFromBody(input.minClinicianMissRefund, 100),
  };
}

function wrapPolicy(policy: Record<string, any>) {
  const admin = normalisePolicy(policy);
  return {
    ok: true,
    admin,
    effective: admin,
  };
}


export async function GET() {
  try {
    if (!GW) {
      return json({ ok: false, error: 'missing_gateway_origin' }, 500);
    }

    const res = await fetch(`${GW}/api/admin/consult/policy`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-role': 'admin',
      },
    });

    const body = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: body?.error || body?.message || `gateway_failed_${res.status}`,
        },
        res.status,
      );
    }

    return json(wrapPolicy(body));
  } catch (err: any) {
    console.error('[admin-dashboard] GET /api/settings/consult failed', err);
    return json({ ok: false, error: err?.message || 'consult_policy_load_failed' }, 500);
  }
}
