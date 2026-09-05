import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import { runCoveragePreflight } from '@ambulant/client-core/src/preflight';

export type BookingFundingMethod = 'CARD' | 'MEDICAL_AID' | 'VOUCHER';

export type BookingFundingPreview = {
  method: BookingFundingMethod;
  canProceed: boolean;
  decision: string;
  reason: string;
  sponsorAmountMinor: number;
  patientPayableMinor: number;
  currency: string;
  authorizationRequired: boolean;
  clientId?: string;
  clientMemberId?: string;
  coveragePlanId?: string;
  voucherId?: string;
  voucherLast4?: string;
  voucherValueMinor?: number;
  ruleSnapshot?: Record<string, unknown>;
};

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeBookingFundingMethod(value: unknown): BookingFundingMethod {
  const method = clean(value, 40).toUpperCase().replace(/-/g, '_');
  if (method === 'MEDICAL_AID' || method === 'MEDICALAID') return 'MEDICAL_AID';
  if (method === 'VOUCHER' || method === 'VOUCHER_PROMO' || method === 'VOUCHER_PROMO_CODE') return 'VOUCHER';
  return 'CARD';
}

export function normalizeVoucherCode(value: unknown) {
  return clean(value, 160)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function voucherHash(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function previewVoucherFunding(args: {
  code: string;
  clinicianId: string;
  hostUserId: string;
  totalAmountMinor: number;
  currency: string;
  db?: any;
}): Promise<BookingFundingPreview> {
  const db = args.db ?? prisma;
  const code = normalizeVoucherCode(args.code);
  if (!code) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_CODE_REQUIRED',
      reason: 'Enter a valid appointment voucher code.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  const voucher = await db.voucherCode.findUnique({
    where: { codeHash: voucherHash(code) },
  });

  const now = new Date();
  if (!voucher || !voucher.active) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_INVALID',
      reason: 'This voucher is invalid or inactive.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (voucher.validFrom && voucher.validFrom > now) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_NOT_YET_VALID',
      reason: 'This voucher is not yet valid.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (voucher.expiresAt && voucher.expiresAt <= now) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_EXPIRED',
      reason: 'This voucher has expired.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_EXHAUSTED',
      reason: 'This voucher has already been fully used.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  const constraints = voucher.constraints && typeof voucher.constraints === 'object'
    ? (voucher.constraints as Record<string, any>)
    : {};
  const scopes = Array.isArray(constraints.scopes)
    ? constraints.scopes.map((value: unknown) => clean(value, 80).toUpperCase())
    : [];
  const appointmentAllowed = voucher.kind === 'FREE_CONSULT' || scopes.includes('APPOINTMENT');

  if (!appointmentAllowed) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_NOT_VALID_FOR_APPOINTMENT',
      reason: 'This voucher cannot be used for a consultation booking.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (
    voucher.sponsorType === 'CLINICIAN' &&
    voucher.sponsorId &&
    clean(voucher.sponsorId) !== clean(args.clinicianId)
  ) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_WRONG_CLINICIAN',
      reason: 'This clinician-issued voucher is not valid for the selected clinician.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (voucher.sponsorType === 'CLINICIAN') {
    const perPatientDays = Math.max(0, Number(constraints.perPatientDays || 90));
    if (perPatientDays > 0) {
      const since = new Date(Date.now() - perPatientDays * 24 * 60 * 60 * 1000);
      const recent = await db.voucherRedemption.findFirst({
        where: {
          userId: args.hostUserId,
          redeemedAt: { gte: since },
          voucher: { sponsorType: 'CLINICIAN' },
        },
        orderBy: { redeemedAt: 'desc' },
      }).catch(() => null);
      if (recent) {
        return {
          method: 'VOUCHER',
          canProceed: false,
          decision: 'VOUCHER_RECENT_PROMO_LIMIT',
          reason: 'A clinician-sponsored consultation voucher was used recently on this account.',
          sponsorAmountMinor: 0,
          patientPayableMinor: args.totalAmountMinor,
          currency: args.currency,
          authorizationRequired: false,
        };
      }
    }
  }

  const voucherCurrency = clean(voucher.currency || 'ZAR', 3).toUpperCase();
  if (voucherCurrency !== clean(args.currency, 3).toUpperCase()) {
    return {
      method: 'VOUCHER',
      canProceed: false,
      decision: 'VOUCHER_CURRENCY_MISMATCH',
      reason: 'This voucher uses a different currency from the selected consultation.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  const voucherValueMinor = Math.max(0, Math.round(Number(voucher.valueZar || 0) * 100));
  const sponsorAmountMinor = Math.min(args.totalAmountMinor, voucherValueMinor);
  const patientPayableMinor = Math.max(0, args.totalAmountMinor - sponsorAmountMinor);

  return {
    method: 'VOUCHER',
    canProceed: sponsorAmountMinor > 0,
    decision: patientPayableMinor > 0 ? 'VOUCHER_WITH_BALANCE' : 'VOUCHER_COVERED',
    reason:
      patientPayableMinor > 0
        ? 'Voucher applied. The remaining balance can be paid securely by card.'
        : 'Voucher covers the consultation fee.',
    sponsorAmountMinor,
    patientPayableMinor,
    currency: args.currency,
    authorizationRequired: false,
    voucherId: voucher.id,
    voucherLast4: voucher.codeLast4,
    voucherValueMinor,
    ruleSnapshot: {
      kind: voucher.kind,
      sponsorType: voucher.sponsorType,
      sponsorId: voucher.sponsorId,
      constraints,
    },
  };
}

export async function previewBookingFunding(args: {
  method: BookingFundingMethod;
  patientId: string;
  clinicianUserId: string;
  clinicianId: string;
  hostUserId: string;
  kind: 'STANDARD' | 'FOLLOWUP';
  totalAmountMinor: number;
  currency: string;
  orgId?: string;
  clientId?: string;
  voucherCode?: string;
  db?: any;
}): Promise<BookingFundingPreview> {
  if (args.totalAmountMinor <= 0) {
    return {
      method: args.method,
      canProceed: true,
      decision: 'NOT_REQUIRED',
      reason: 'No patient payment is required for this consultation.',
      sponsorAmountMinor: 0,
      patientPayableMinor: 0,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (args.method === 'CARD') {
    return {
      method: 'CARD',
      canProceed: true,
      decision: 'SELF_PAY',
      reason: 'The consultation fee will be paid securely by card.',
      sponsorAmountMinor: 0,
      patientPayableMinor: args.totalAmountMinor,
      currency: args.currency,
      authorizationRequired: false,
    };
  }

  if (args.method === 'VOUCHER') {
    return previewVoucherFunding({
      code: args.voucherCode || '',
      clinicianId: args.clinicianId,
      hostUserId: args.hostUserId,
      totalAmountMinor: args.totalAmountMinor,
      currency: args.currency,
      db: args.db,
    });
  }

  const coverage = await runCoveragePreflight({
    orgId: args.orgId || 'org-default',
    patientId: args.patientId,
    clinicianId: args.clinicianUserId,
    serviceType: args.kind === 'FOLLOWUP' ? 'CONSULT_FOLLOWUP' : 'CONSULT_STANDARD',
    visitMode: 'TELEVISIT',
    requestedAmountMinor: args.totalAmountMinor,
    clientId: args.clientId || undefined,
    tx: args.db,
  });

  const decision = clean(coverage.decision, 80).toUpperCase();
  const canProceed = ['COVERED', 'COVERED_WITH_COPAY', 'REQUIRES_AUTHORIZATION'].includes(decision);

  return {
    method: 'MEDICAL_AID',
    canProceed,
    decision,
    reason: coverage.reason,
    sponsorAmountMinor: Math.max(0, Number(coverage.sponsorAmountMinor || 0)),
    // runCoveragePreflight already folds any uncovered gap into patientCopayMinor.
    // Do not add uncoveredGapMinor a second time here.
    patientPayableMinor: Math.max(0, Number(coverage.patientCopayMinor || 0)),
    currency: clean(coverage.currency || args.currency, 3).toUpperCase(),
    authorizationRequired: Boolean(coverage.authorizationRequired),
    clientId: coverage.clientId,
    clientMemberId: coverage.clientMemberId,
    coveragePlanId: coverage.coveragePlanId,
    ruleSnapshot: coverage.ruleSnapshot,
  };
}
