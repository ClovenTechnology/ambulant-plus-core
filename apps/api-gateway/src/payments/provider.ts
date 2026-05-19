// apps/api-gateway/src/payments/provider.ts
export type PaymentProviderName = 'paystack' | 'payfast' | 'mock';

export type InitializeCheckoutInput = {
  amountCents: number;
  currency: string;
  email: string;
  reference: string;
  callbackUrl?: string | null;
  metadata?: Record<string, any>;
};

export type InitializeCheckoutResult = {
  provider: PaymentProviderName;
  reference: string;
  status: 'pending_redirect' | 'authorized' | 'declined';
  redirectUrl: string | null;
  raw?: any;
};

export type VerifyCheckoutResult = {
  provider: PaymentProviderName;
  reference: string;
  status: 'captured' | 'pending' | 'failed';
  amountCents?: number;
  currency?: string;
  raw?: any;
};

export type RefundResult = {
  providerRef: string;
  status: 'refunded' | 'failed';
  meta?: any;
};

export interface PaymentProvider {
  initializeCheckout(input: InitializeCheckoutInput): Promise<InitializeCheckoutResult>;
  verifyCheckout(reference: string): Promise<VerifyCheckoutResult>;
  refund(providerRef: string, amountCents?: number): Promise<RefundResult>;
}

export class MockProvider implements PaymentProvider {
  async initializeCheckout(input: InitializeCheckoutInput): Promise<InitializeCheckoutResult> {
    return {
      provider: 'mock',
      reference: input.reference,
      status: 'pending_redirect',
      redirectUrl: `https://example.invalid/mock-pay/${encodeURIComponent(input.reference)}`,
      raw: input,
    };
  }

  async verifyCheckout(reference: string): Promise<VerifyCheckoutResult> {
    return {
      provider: 'mock',
      reference,
      status: 'captured',
      raw: { mock: true },
    };
  }

  async refund(providerRef: string, amountCents?: number): Promise<RefundResult> {
    return { providerRef, status: 'refunded', meta: { amountCents } };
  }
}