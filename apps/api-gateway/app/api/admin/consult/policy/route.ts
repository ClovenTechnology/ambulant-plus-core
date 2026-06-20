import { NextRequest, NextResponse } from 'next/server';
import { getAdminPolicy, setAdminPolicy } from '@/src/store/consult';

export const dynamic = 'force-dynamic';

function isAdmin(h: Headers) {
  return (h.get('x-role') || '') === 'admin';
}

function numberFromBody(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const policy = await getAdminPolicy();
    return NextResponse.json(policy);
  } catch (err: any) {
    console.error('[api-gateway] admin consult policy GET failed', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'admin_consult_policy_load_failed' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const current = await getAdminPolicy();

    const saved = await setAdminPolicy({
      minStandardMinutes: numberFromBody(
        body.minStandardMinutes,
        current.minStandardMinutes ?? 30,
      ),
      minFollowupMinutes: numberFromBody(
        body.minFollowupMinutes,
        current.minFollowupMinutes ?? 15,
      ),
      bufferAfterMinutes: numberFromBody(
        body.bufferAfterMinutes,
        current.bufferAfterMinutes ?? 5,
      ),
      joinGracePatientMin: numberFromBody(
        body.joinGracePatientMin,
        current.joinGracePatientMin ?? 5,
      ),
      joinGraceClinicianMin: numberFromBody(
        body.joinGraceClinicianMin,
        current.joinGraceClinicianMin ?? 5,
      ),
    });

    return NextResponse.json({ ok: true, admin: saved });
  } catch (err: any) {
    console.error('[api-gateway] admin consult policy PUT failed', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'admin_consult_policy_save_failed' },
      { status: 500 },
    );
  }
}
