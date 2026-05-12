export type Money = {
  amountCents: number;
  currency: string; // e.g. "ZAR"
};

export function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Split a total charge into platform fee + clinician take.
 * Default: 10% platform fee.
 */
export function split(
  totalCents: number,
  opts?: { platformPct?: number; minPlatformFeeCents?: number },
): { platformFeeCents: number; clinicianTakeCents: number } {
  const platformPct = opts?.platformPct ?? 0.1;
  const minPlatformFeeCents = opts?.minPlatformFeeCents ?? 0;

  const fee = Math.max(
    minPlatformFeeCents,
    Math.round((Number(totalCents) || 0) * platformPct),
  );

  const platformFeeCents = Math.max(0, Math.min(Number(totalCents) || 0, fee));
  const clinicianTakeCents = Math.max(0, (Number(totalCents) || 0) - platformFeeCents);

  return { platformFeeCents, clinicianTakeCents };
}
