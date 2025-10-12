import { prisma } from '@/src/lib/db';

function periodKey(d = new Date()) {
  const y = d.getFullYear(), m = `${d.getMonth()+1}`.padStart(2,'0');
  return `${y}-${m}-01`;
}

export async function createOrUpdatePayout(input: {
  role: 'clinician'|'rider'|'phleb'|'platform';
  entityId: string;
  amountCents: number;
  currency: string;
  meta?: any;
}) {
  const start = new Date(periodKey());
  const end = new Date(start); end.setMonth(end.getMonth() + 1);

  const row = await prisma.payout.findFirst({
    where: { role: input.role, entityId: input.entityId, periodStart: start, periodEnd: end }
  });

  if (!row) {
    return prisma.payout.create({
      data: {
        role: input.role,
        entityId: input.entityId,
        periodStart: start,
        periodEnd: end,
        amountCents: input.amountCents,
        currency: input.currency,
        status: 'pending',
        meta: input.meta ?? {}
      }
    });
  } else {
    return prisma.payout.update({
      where: { id: row.id },
      data: {
        amountCents: row.amountCents + input.amountCents,
        meta: input.meta ?? row.meta
      }
    });
  }
}
