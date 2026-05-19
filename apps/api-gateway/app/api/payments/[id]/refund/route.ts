// apps/api-gateway/app/api/payments/[id]/refund/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const who = readIdentity(req.headers);

  if (who.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const pay = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!pay) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const meta = readMeta(pay.meta);
  const providerKind = String(meta.provider || 'mock') as 'paystack' | 'payfast' | 'mock';
  const provider = getProvider(providerKind);
  const ref = pay.providerRef || `mock_${pay.id}`;

  const refund = await provider.refund(ref, pay.amountCents);

  const updated = await prisma.payment.update({
    where: { id: pay.id },
    data: {
      status: refund.status === 'refunded' ? 'refunded' : 'refund_failed',
      meta: jsonSafe({
        ...meta,
        refund: {
          providerRef: ref,
          status: refund.status,
          meta: refund.meta ?? null,
          refundedAt: new Date().toISOString(),
        },
      }),
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'payment_refunded',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: updated.id,
      meta: jsonSafe({
        encounterId: pay.encounterId,
        amountCents: pay.amountCents,
        providerRef: ref,
        refund,
      }),
    },
  });

  try {
    emitEvent({
      kind: 'payment_refunded',
      encounterId: pay.encounterId,
      patientId: null,
      clinicianId: null,
      payload: { paymentId: pay.id, amount: pay.amountCents },
    } as any);
  } catch {
    // best-effort runtime event
  }

  return NextResponse.json(
    { ok: true, payment: updated, refund },
    { headers: { 'access-control-allow-origin': '*' } },
  );
}