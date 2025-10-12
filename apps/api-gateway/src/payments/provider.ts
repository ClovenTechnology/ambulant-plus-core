// apps/api-gateway/src/payments/provider.ts
export type CaptureInput = { encounterId: string; amountCents: number; currency: string; meta?: Record<string,any> };
export type CaptureResult = { providerRef: string; status: 'captured'|'failed'; meta?: any };
export type RefundResult = { providerRef: string; status: 'refunded'|'failed'; meta?: any };

export interface PaymentProvider {
  capture(input: CaptureInput): Promise<CaptureResult>;
  refund(providerRef: string, amountCents?: number): Promise<RefundResult>;
}

// default mock
export class MockProvider implements PaymentProvider {
  async capture(input: CaptureInput): Promise<CaptureResult> {
    return { providerRef: `mock_${Math.random().toString(36).slice(2,8)}`, status: 'captured', meta: input };
  }
  async refund(ref: string, amountCents?: number): Promise<RefundResult> {
    return { providerRef: ref, status: 'refunded', meta: { amountCents } };
  }
}
