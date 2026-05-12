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

  const policy = await getAdminPolicy();
  return NextResponse.json(policy);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const current = await getAdminPolicy();

  await setAdminPolicy({
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

    // Required refund-policy fields on AdminPolicy.
    // Preserve existing values unless explicitly changed by the request body.
    minCancel24hRefund: numberFromBody(
      body.minCancel24hRefund,
      current.minCancel24hRefund ?? 100,
    ),
    minNoShowRefund: numberFromBody(
      body.minNoShowRefund,
      current.minNoShowRefund ?? 0,
    ),
    minClinicianMissRefund: numberFromBody(
      body.minClinicianMissRefund,
      current.minClinicianMissRefund ?? 100,
    ),
  });

  return NextResponse.json({ ok: true });
}