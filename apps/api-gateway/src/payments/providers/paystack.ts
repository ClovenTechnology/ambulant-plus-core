// apps/api-gateway/src/payments/providers/paystack.ts
import {
  PaymentProvider,
  InitializeCheckoutInput,
  InitializeCheckoutResult,
  VerifyCheckoutResult,
  RefundResult,
} from '../provider';

function paystackBaseUrl() {
  return process.env.PAYSTACK_BASE_URL?.trim() || 'https://api.paystack.co';
}

function normalizeStatus(status: string | undefined): VerifyCheckoutResult['status'] {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'captured';
  if (s === 'pending' || s === 'ongoing' || s === 'queued' || s === 'processing') return 'pending';
  return 'failed';
}

export class PaystackProvider implements PaymentProvider {
  constructor(private secretKey: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeCheckout(input: InitializeCheckoutInput): Promise<InitializeCheckoutResult> {
    const res = await fetch(`${paystackBaseUrl()}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountCents),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl || undefined,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      }),
    });

    const js = await res.json().catch(() => ({} as any));
    if (!res.ok || js?.status !== true || !js?.data?.reference) {
      throw new Error(js?.message || 'paystack_initialize_failed');
    }

    return {
      provider: 'paystack',
      reference: String(js.data.reference),
      status: 'pending_redirect',
      redirectUrl:
        typeof js?.data?.authorization_url === 'string'
          ? js.data.authorization_url
          : null,
      raw: js,
    };
  }

  async verifyCheckout(reference: string): Promise<VerifyCheckoutResult> {
    const res = await fetch(
      `${paystackBaseUrl()}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: this.headers(),
      },
    );

    const js = await res.json().catch(() => ({} as any));
    if (!res.ok || js?.status !== true || !js?.data?.reference) {
      throw new Error(js?.message || 'paystack_verify_failed');
    }

    return {
      provider: 'paystack',
      reference: String(js.data.reference),
      status: normalizeStatus(js?.data?.status),
      amountCents:
        typeof js?.data?.amount === 'number'
          ? js.data.amount
          : Number(js?.data?.amount || 0),
      currency: typeof js?.data?.currency === 'string' ? js.data.currency : undefined,
      raw: js,
    };
  }

  async refund(providerRef: string, amountCents?: number): Promise<RefundResult> {
    const res = await fetch(`${paystackBaseUrl()}/refund`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        transaction: providerRef,
        amount: typeof amountCents === 'number' ? amountCents : undefined,
      }),
    });

    const js = await res.json().catch(() => ({} as any));
    if (!res.ok || js?.status !== true) {
      return {
        providerRef,
        status: 'failed',
        meta: js,
      };
    }

    return {
      providerRef,
      status: 'refunded',
      meta: js,
    };
  }
}