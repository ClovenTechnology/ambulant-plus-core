import crypto from 'node:crypto';
import { getProvider } from '@/src/payments';

export type CheckoutMethod = 'CARD' | 'MEDICAL_AID' | 'VOUCHER';

export type BeginCheckoutInput = {
  method: CheckoutMethod;
  appointmentId: string;
  amountCents: number;
  currency: string;
  email?: string | null;
  callbackUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type BeginCheckoutResult = {
  provider: 'paystack' | 'payfast' | 'internal' | 'mock';
  reference: string;
  status: 'pending_redirect' | 'authorized' | 'declined' | 'pending_review';
  redirectUrl: string | null;
  raw?: Record<string, unknown>;
};

export type VerifyCheckoutInput = {
  provider: 'paystack' | 'payfast' | 'mock';
  reference: string;
  expectedAmountCents: number;
  expectedCurrency: string;
};

export type VerifyCheckoutResult = {
  provider: 'paystack' | 'payfast' | 'mock';
  reference: string;
  status: 'captured' | 'pending' | 'failed';
  amountCents?: number;
  currency?: string;
  raw?: Record<string, unknown>;
};

function makeReference(prefix: string, appointmentId: string) {
  return `${prefix}_${appointmentId}_${crypto.randomBytes(6).toString('hex')}`;
}

export async function beginCheckout(input: BeginCheckoutInput): Promise<BeginCheckoutResult> {
  if (input.amountCents <= 0) {
    return {
      provider: 'internal',
      reference: makeReference('zero', input.appointmentId),
      status: 'authorized',
      redirectUrl: null,
      raw: { reason: 'zero_amount' },
    };
  }

  if (input.method === 'MEDICAL_AID') {
    const sponsor = (input.metadata?.sponsor || null) as Record<string, any> | null;
    const decision = String(sponsor?.decision || '').toUpperCase();
    const copay = Number(sponsor?.patientCopayMinor ?? input.amountCents);

    if (decision === 'COVERED' && copay === 0) {
      return {
        provider: 'internal',
        reference: makeReference('medicalaid', input.appointmentId),
        status: 'authorized',
        redirectUrl: null,
        raw: { decision, copay },
      };
    }

    return {
      provider: 'internal',
      reference: makeReference('medicalaid', input.appointmentId),
      status: 'pending_review',
      redirectUrl: null,
      raw: { decision, copay },
    };
  }

  if (input.method === 'VOUCHER') {
    const voucherCode = String((input.metadata as any)?.voucherCode || '').trim();
    const voucherApplied = Boolean((input.metadata as any)?.voucherApplied);

    if (voucherCode && voucherApplied) {
      return {
        provider: 'internal',
        reference: makeReference('voucher', input.appointmentId),
        status: 'authorized',
        redirectUrl: null,
        raw: { voucherCode },
      };
    }

    return {
      provider: 'internal',
      reference: makeReference('voucher', input.appointmentId),
      status: 'declined',
      redirectUrl: null,
      raw: { reason: 'voucher_not_applied' },
    };
  }

  if (!input.email?.trim()) {
    throw new Error('patient_email_required_for_card_checkout');
  }

  const reference = makeReference('pay', input.appointmentId);
  const providerKind =
    (process.env.CARD_PAYMENT_PROVIDER || 'paystack').toLowerCase() === 'payfast'
      ? 'payfast'
      : 'paystack';

  const provider = getProvider(providerKind);
  const init = await provider.initializeCheckout({
    amountCents: input.amountCents,
    currency: input.currency,
    email: input.email.trim(),
    reference,
    callbackUrl:
      input.callbackUrl ||
      process.env.PAYSTACK_CALLBACK_URL?.trim() ||
      undefined,
    metadata: input.metadata as Record<string, any> | undefined,
  });

  return {
    provider: init.provider,
    reference: init.reference,
    status: init.status,
    redirectUrl: init.redirectUrl,
    raw: init.raw,
  };
}

export async function verifyCheckout(input: VerifyCheckoutInput): Promise<VerifyCheckoutResult> {
  const provider = getProvider(input.provider);
  const verified = await provider.verifyCheckout(input.reference);

  if (
    verified.status === 'captured' &&
    typeof verified.amountCents === 'number' &&
    Number(input.expectedAmountCents || 0) > 0 &&
    verified.amountCents !== Number(input.expectedAmountCents)
  ) {
    return {
      ...verified,
      status: 'failed',
      raw: {
        ...(verified.raw || {}),
        verificationError: 'amount_mismatch',
      },
    };
  }

  if (
    verified.status === 'captured' &&
    verified.currency &&
    input.expectedCurrency &&
    verified.currency.toUpperCase() !== input.expectedCurrency.toUpperCase()
  ) {
    return {
      ...verified,
      status: 'failed',
      raw: {
        ...(verified.raw || {}),
        verificationError: 'currency_mismatch',
      },
    };
  }

  return verified;
}