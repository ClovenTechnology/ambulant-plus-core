//apps/api-gateway/app/api/finance/payouts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json().catch(() => ({} as any));
    const status = String(body.status || '').toLowerCase();

    if (!['paid', 'pending', 'failed', 'refunded'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 });
    }

    const data: any = { status };
    if (status === 'paid') {
      data.updatedAt = new Date();
      data.meta = {
        ...(body.meta ?? {}),
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
        providerRef: body.providerRef ?? null,
      };
    } else if (body.meta) {
      data.meta = body.meta;
    }

    const rec = await prisma.payout.update({ where: { id }, data });
    await prisma.auditEvent.create({
      data: {
        kind: 'payout_status_change',
        subjectId: id,
        meta: { to: status, providerRef: body?.providerRef ?? null },
      },
    });

    return NextResponse.json({ ok: true, payout: rec });
  } catch (err: any) {
    console.error('PATCH /api/finance/payouts/[id]', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
