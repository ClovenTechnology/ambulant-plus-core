// apps/api-gateway/src/lib/payouts.ts
import { prisma } from '@/src/lib/db';

export type PayoutConfig = {
  id: string;
  clinicianConsultPayoutPercent: number;
  riderDeliveryPayoutCents: number;
  phlebDrawPayoutCents: number;
  currency: string;
};

export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  id: 'default',
  clinicianConsultPayoutPercent: 70,
  riderDeliveryPayoutCents: 0,
  phlebDrawPayoutCents: 0,
  currency: 'ZAR',
};

function payoutConfigDelegate() {
  return (prisma as any).payoutConfig ?? null;
}

function cleanCurrency(value: unknown, fallback = 'ZAR') {
  const s = String(value ?? fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : fallback;
}

function percent(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cents(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function normalizeConfig(row: any): PayoutConfig {
  return {
    id: String(row?.id || DEFAULT_PAYOUT_CONFIG.id),
    clinicianConsultPayoutPercent: percent(
      row?.clinicianConsultPayoutPercent,
      DEFAULT_PAYOUT_CONFIG.clinicianConsultPayoutPercent,
    ),
    riderDeliveryPayoutCents: cents(
      row?.riderDeliveryPayoutCents,
      DEFAULT_PAYOUT_CONFIG.riderDeliveryPayoutCents,
    ),
    phlebDrawPayoutCents: cents(
      row?.phlebDrawPayoutCents,
      DEFAULT_PAYOUT_CONFIG.phlebDrawPayoutCents,
    ),
    currency: cleanCurrency(row?.currency, DEFAULT_PAYOUT_CONFIG.currency),
  };
}

/**
 * Reads payout config from DB if the schema exposes payoutConfig.
 * Falls back to safe defaults if this model/table is not present.
 */
export async function getConfig(): Promise<PayoutConfig> {
  const delegate = payoutConfigDelegate();

  if (!delegate?.findUnique) {
    return DEFAULT_PAYOUT_CONFIG;
  }

  const cfg = await delegate
    .findUnique({
      where: { id: 'default' },
    })
    .catch(() => null);

  if (!cfg) {
    return DEFAULT_PAYOUT_CONFIG;
  }

  return normalizeConfig(cfg);
}

/**
 * Upserts payout config only when the model exists.
 * If the current deploy schema does not expose payoutConfig, return merged defaults
 * without failing the build/runtime.
 */
export async function setConfig(input: Partial<PayoutConfig>): Promise<PayoutConfig> {
  const next: PayoutConfig = {
    id: 'default',
    clinicianConsultPayoutPercent: percent(
      input.clinicianConsultPayoutPercent,
      DEFAULT_PAYOUT_CONFIG.clinicianConsultPayoutPercent,
    ),
    riderDeliveryPayoutCents: cents(
      input.riderDeliveryPayoutCents,
      DEFAULT_PAYOUT_CONFIG.riderDeliveryPayoutCents,
    ),
    phlebDrawPayoutCents: cents(
      input.phlebDrawPayoutCents,
      DEFAULT_PAYOUT_CONFIG.phlebDrawPayoutCents,
    ),
    currency: cleanCurrency(input.currency, DEFAULT_PAYOUT_CONFIG.currency),
  };

  const delegate = payoutConfigDelegate();

  if (!delegate?.upsert) {
    return next;
  }

  const saved = await delegate
    .upsert({
      where: { id: 'default' },
      update: {
        clinicianConsultPayoutPercent: next.clinicianConsultPayoutPercent,
        riderDeliveryPayoutCents: next.riderDeliveryPayoutCents,
        phlebDrawPayoutCents: next.phlebDrawPayoutCents,
        currency: next.currency,
      },
      create: {
        id: 'default',
        clinicianConsultPayoutPercent: next.clinicianConsultPayoutPercent,
        riderDeliveryPayoutCents: next.riderDeliveryPayoutCents,
        phlebDrawPayoutCents: next.phlebDrawPayoutCents,
        currency: next.currency,
      },
    })
    .catch(() => null);

  return saved ? normalizeConfig(saved) : next;
}

export function splitConsultationAmount(amountCents: number, clinicianPercent: number) {
  const gross = cents(amountCents, 0);
  const pct = percent(clinicianPercent, DEFAULT_PAYOUT_CONFIG.clinicianConsultPayoutPercent);

  const clinicianTakeCents = Math.round((gross * pct) / 100);
  const platformFeeCents = Math.max(0, gross - clinicianTakeCents);

  return {
    grossCents: gross,
    clinicianTakeCents,
    platformFeeCents,
    clinicianPercent: pct,
    platformPercent: 100 - pct,
  };
}

export async function getConsultationSplit(amountCents: number) {
  const cfg = await getConfig();

  return {
    ...splitConsultationAmount(amountCents, cfg.clinicianConsultPayoutPercent),
    currency: cfg.currency,
  };
}