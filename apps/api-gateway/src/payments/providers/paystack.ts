// apps/api-gateway/src/payments/providers/paystack.ts
import { PaymentProvider, CaptureInput, CaptureResult, RefundResult } from '../provider';
export class PaystackProvider implements PaymentProvider {
  constructor(private secretKey: string) {}
  async capture(input: CaptureInput): Promise<CaptureResult> {
    // TODO: call Paystack charge/transaction endpoint
    return { providerRef: `pstk_${Date.now()}`, status: 'captured', meta: input };
  }
  async refund(ref: string, amountCents?: number): Promise<RefundResult> {
    // TODO: call Paystack refund endpoint
    return { providerRef: ref, status: 'refunded', meta: { amountCents } };
  }
}
