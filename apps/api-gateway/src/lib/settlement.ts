import { prisma } from '@/src/lib/db';

export type Refunds = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

export type ConsultSettings = {
  defaultMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  refunds: Refunds;
};

export function computeRefundPercent(ctx: {
  reason: 'cancel_lt24h' | 'no_show' | 'clinician_miss' | 'network_interrupt';
  elapsedMinutes?: number;
  plannedMinutes?: number;
  settings: ConsultSettings;
}): number {
  switch (ctx.reason) {
    case 'cancel_lt24h': return ctx.settings.refunds.within24hPercent;
    case 'no_show': return ctx.settings.refunds.noShowPercent;
    case 'clinician_miss': return ctx.settings.refunds.clinicianMissPercent;
    case 'network_interrupt': {
      if (!ctx.settings.refunds.networkProrate) return 0;
      const p = Math.max(0, Math.min(1, (ctx.elapsedMinutes || 0) / Math.max(1,(ctx.plannedMinutes || 1))));
      const keep = Math.round(p * 100); // percent kept for time used
      return Math.max(0, 100 - keep);   // refund remainder
    }
  }
}

export async function settleAppointment(apptId: string, opts: {
  reason?: 'initial_capture' | 'cancel_lt24h' | 'no_show' | 'clinician_miss' | 'network_interrupt';
  elapsedMinutes?: number;
}) {
  const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
  if (!appt) return;

  // load consult settings – for sprint, read from a generic table or fall back
  // If you already persist consult settings, replace this stub with your store.
  const settings: ConsultSettings = {
    defaultMinutes: 25, bufferMinutes: 5, minAdvanceMinutes: 30, maxAdvanceDays: 30,
    refunds: { within24hPercent: 50, noShowPercent: 0, clinicianMissPercent: 100, networkProrate: true }
  };

  const reason = opts.reason || 'initial_capture';

  let refundPct = 0;
  if (reason !== 'initial_capture') {
    refundPct = computeRefundPercent({
      reason: reason as any,
      elapsedMinutes: opts.elapsedMinutes,
      plannedMinutes: settings.defaultMinutes,
      settings,
    });
  }

  const price = appt.priceCents;
  const refundCents = Math.round(price * (refundPct / 100));
  const netCollected = Math.max(0, price - refundCents);

  // platform / clinician splits are based on immutable snapshot
  const platform = Math.round(appt.platformFeeCents * (netCollected / price));
  const clinician = Math.round(appt.clinicianTakeCents * (netCollected / price));

  // record payout intent (idempotent on appointment)
  await prisma.payout.upsert({
    where: { id: `clin_${appt.id}` },
    update: {
      role: 'clinician',
      entityId: appt.clinicianId,
      amountCents: clinician,
      status: 'pending',
    },
    create: {
      id: `clin_${appt.id}`,
      role: 'clinician',
      entityId: appt.clinicianId,
      amountCents: clinician,
      currency: appt.currency,
      periodStart: new Date(),
      periodEnd: new Date(),
      status: 'pending',
    }
  });

  // mark appointment status if needed
  if (reason === 'initial_capture' && appt.status !== 'confirmed') {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'confirmed' } });
  }
  if (reason !== 'initial_capture') {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'completed' } });
  }

  return { refundCents, netCollected, platformCents: platform, clinicianCents: clinician };
}
