// apps/api-gateway/app/api/payments/[id]/refund/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const who = readIdentity(req.headers);
  if (who.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const pay = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!pay) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const provider = getProvider();
  const ref = pay.meta?.providerRef as string | undefined;
  await provider.refund(ref || `mock_${pay.id}`, pay.amountCents);

  const updated = await prisma.payment.update({
    where: { id: pay.id },
    data: { status: 'refunded', updatedAt: new Date() },
  });

  // AUDIT
  await prisma.auditEvent.create({
    data: {
      kind: 'payment_refunded',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: updated.id,
      meta: { encounterId: pay.encounterId, amountCents: pay.amountCents, providerRef: ref || `mock_${pay.id}` },
    },
  });

  await emitEvent({
    kind: 'payment_refunded',
    encounterId: pay.encounterId,
    patientId: 'pt-za-001',
    clinicianId: 'clin-za-001',
    payload: { paymentId: pay.id, amount: pay.amountCents },
    targets: { admin: true, patientId: 'pt-za-001' },
  });

  return NextResponse.json(updated, { headers: { 'access-control-allow-origin': '*' } });
}
