// apps/admin-dashboard/app/api/settings/consult/admin/route.ts
import { NextRequest, NextResponse } from 'next/server';

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


export async function PUT(req: NextRequest) {
  try {
    if (!GW) {
      return json({ ok: false, error: 'missing_gateway_origin' }, 500);
    }

    const body = await req.json().catch(() => ({} as any));
    const source = body?.admin && typeof body.admin === 'object' ? body.admin : body;
    const payload = normalisePolicy(source);

    const res = await fetch(`${GW}/api/admin/consult/policy`, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify(payload),
    });

    const gwBody = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: gwBody?.error || gwBody?.message || `gateway_failed_${res.status}`,
          message: gwBody?.error || gwBody?.message || `gateway_failed_${res.status}`,
        },
        res.status,
      );
    }

    return json(wrapPolicy(payload));
  } catch (err: any) {
    console.error('[admin-dashboard] PUT /api/settings/consult/admin failed', err);
    return json({ ok: false, error: err?.message || 'consult_policy_save_failed' }, 500);
  }
}
