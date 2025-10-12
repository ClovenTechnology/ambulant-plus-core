/**
 * Refund policy:
 * - <24h patient cancel: 50% refund
 * - No-show (patient): 0%
 * - Clinician misses: 100% or fast rebook (treat as 100% refund here; ops can rebook)
 * - Interrupted network: prorate by connected minutes / scheduled minutes
 */

export type RefundContext = {
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  cancelAt?: Date | null;
  cancelBy?: 'patient'|'clinician'|null;
  joinedAtMs?: number;   // ms connected
  scheduledMs?: number;  // ms scheduled
};

export function computeRefundCents(ctx: RefundContext): number {
  const price = ctx.priceCents ?? 0;
  const startMs = ctx.startsAt.getTime();
  const cancelMs = ctx.cancelAt?.getTime();

  // Clinician cancel/miss -> full refund
  if (ctx.cancelBy === 'clinician') return price;

  // Patient cancel < 24h -> 50%
  if (ctx.cancelBy === 'patient' && cancelMs && (startMs - cancelMs) < 24*3600*1000) {
    return Math.round(price * 0.5);
  }

  // Interrupted network → prorate (if provided)
  if ((ctx.joinedAtMs ?? 0) > 0 && (ctx.scheduledMs ?? 0) > 0) {
    const ratio = Math.max(0, Math.min(1, 1 - (ctx.joinedAtMs! / ctx.scheduledMs!)));
    return Math.round(price * ratio);
  }

  // No-show patient or cancel >= 24h -> 0
  return 0;
}
