// apps/api-gateway/src/payments/index.ts
import { MockProvider, PaymentProvider } from './provider';
import { PaystackProvider } from './providers/paystack';
import { PayfastProvider } from './providers/payfast';

export type PaymentProviderKind = 'paystack' | 'payfast' | 'mock';

export function getProvider(kind?: PaymentProviderKind): PaymentProvider {
  const resolved = (kind || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();

  switch (resolved) {
    case 'paystack':
      return new PaystackProvider(process.env.PAYSTACK_SECRET_KEY || '');
    case 'payfast':
      return new PayfastProvider();
    default:
      return new MockProvider();
  }
}