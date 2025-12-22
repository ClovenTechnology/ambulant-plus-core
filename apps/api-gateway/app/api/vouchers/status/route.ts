//apps/api-gateway/app/api/vouchers/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

function cors(json: any, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { 'access-control-allow-origin': '*' },
  });
}

export async function PATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') {
    return cors({ error: 'forbidden' }, 403);
  }

  const raw = await req.json().catch(() => ({} as any));
  const id = String(raw.id || '').trim();
  const active =
    typeof raw.active === 'boolean' ? raw.active : undefined;

  if (!id || typeof active !== 'boolean') {
    return cors({ error: 'id_and_active_required' }, 400);
  }

  const voucher = await prisma.promoToken.update({
    where: { id },
    data: { active },
  });

  return cors({ ok: true, voucher });
}
