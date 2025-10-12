// apps/api-gateway/src/payments/index.ts
import { MockProvider, PaymentProvider } from './provider';
import { PaystackProvider } from './providers/paystack';

export function getProvider(): PaymentProvider {
  const kind = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  switch (kind) {
    case 'paystack': return new PaystackProvider(process.env.PAYSTACK_SECRET_KEY || 'sk_test');
    // case 'yoco': return new YocoProvider(...);
    // case 'payfast': return new PayfastProvider(...);
    default: return new MockProvider();
  }
}
