// apps/api-gateway/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'patient' && who.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const amountCents = Number(b.amountCents ?? 85000);
  const currency = b.currency ?? 'ZAR';
  const encounterId = b.encounterId ?? 'enc-za-001';

  const provider = getProvider();
  const res = await provider.capture({
    encounterId,
    amountCents,
    currency,
    meta: b.meta,
  });

  const pay = await prisma.payment.create({
    data: {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      encounterId,
      caseId: b.caseId ?? 'case-za-001',
      amountCents,
      currency,
      status: res.status === 'captured' ? 'captured' : 'failed',
      meta: {
        ...(b.meta ?? {}),
        // funding hints for claims
        paymentMethod: b.meta?.paymentMethod ?? b.paymentMethod ?? 'self-pay-card',
        membershipId: b.meta?.membershipId ?? b.membershipId ?? null,
        voucherCode: b.meta?.voucherCode ?? b.voucherCode ?? null,
        providerRef: res.providerRef,
      },
    },
  });

  // AUDIT
  await prisma.auditEvent.create({
    data: {
      kind: 'payment_initiated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: pay.id,
      meta: { encounterId, amountCents, currency, providerRef: res.providerRef },
    },
  });

  const patientId =
    who.role === 'patient'
      ? (who.uid ?? b.patientId ?? 'pt-za-001')
      : (b.patientId ?? 'pt-za-001');
  const clinicianId = b.clinicianId ?? 'clin-za-001';

  await emitEvent({
    kind: 'payment_captured',
    encounterId,
    patientId,
    clinicianId,
    payload: { paymentId: pay.id, amount: pay.amountCents },
    targets: { admin: true, patientId },
  });

  return NextResponse.json(pay, {
    status: 201,
    headers: { 'access-control-allow-origin': '*' },
  });
}
