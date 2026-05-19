export type DeliveryRule = {
  baseFeeCents: number;
  includedKm: number;
  extraPerKmCents: number;
  codEnabled: boolean;
  codLimitCents: number;
};

export function calcDeliveryFeeCents(rule: DeliveryRule, distanceKm: number): number {
  const d = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const extraKm = Math.max(0, Math.ceil(d - rule.includedKm));
  return rule.baseFeeCents + extraKm * rule.extraPerKmCents;
}

export function isCodAllowed(rule: DeliveryRule, totalCents: number): boolean {
  return rule.codEnabled && totalCents <= rule.codLimitCents;
}
