// apps/patient-app/app/api/admin/vouchers/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { genCode, hashCode, normalizeCode } from '@/lib/wallet.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthed(req: NextRequest) {
  const token = req.headers.get('x-admin-token') || '';
  return token && process.env.ADMIN_VOUCHER_TOKEN && token === process.env.ADMIN_VOUCHER_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as any;

  const kind = (String(body?.kind || 'CREDIT').toUpperCase() as any) || 'CREDIT';
  const valueZar = Math.max(0, Math.trunc(Number(body?.valueZar ?? 0)));
  if (!valueZar) return NextResponse.json({ ok: false, error: 'valueZar required.' }, { status: 400 });

  const sponsorType = (String(body?.sponsorType || 'PLATFORM').toUpperCase() as any) || 'PLATFORM';
  const sponsorId = body?.sponsorId ? String(body.sponsorId) : null;

  const constraints = body?.constraints ?? null; // e.g. { scopes:["SHOP","PLAN"], planTarget:"premium", autoApply:true }

  // generate until unique hash (rare collision protection)
  let raw = '';
  let h = '';
  for (let i = 0; i < 10; i++) {
    raw = normalizeCode(genCode('AMB', 3, 4));
    h = hashCode(raw);
    const exists = await prisma.voucherCode.findUnique({ where: { codeHash: h } });
    if (!exists) break;
  }

  const last4 = raw.slice(-4);

  const v = await prisma.voucherCode.create({
    data: {
      codeHash: h,
      codeLast4: last4,
      kind,
      valueZar,
      currency: 'ZAR',
      sponsorType,
      sponsorId,
      constraints,
      maxUses: Math.max(1, Math.trunc(Number(body?.maxUses ?? 1))),
      usedCount: 0,
      active: true,
      expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
      createdByUserId: body?.createdByUserId ? String(body.createdByUserId) : null,
      orgId: 'org-default',
    },
  });

  return NextResponse.json({
    ok: true,
    id: v.id,
    code: raw, // ✅ only returned once to admin
    codeLast4: v.codeLast4,
    kind: v.kind,
    valueZar: v.valueZar,
  });
}
