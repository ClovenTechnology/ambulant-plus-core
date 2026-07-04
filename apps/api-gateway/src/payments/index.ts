// apps/api-gateway/src/payments/index.ts
import { MockProvider, PaymentProvider } from './provider';
import { PaystackProvider } from './providers/paystack';
import { PayfastProvider } from './providers/payfast';

export type PaymentProviderKind = 'paystack' | 'payfast' | 'mock';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function mockPaymentsAllowed() {
  const v = String(process.env.ALLOW_MOCK_PAYMENT_PROVIDER || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function cleanProvider(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function getProvider(kind?: PaymentProviderKind): PaymentProvider {
  const resolved = cleanProvider(
    kind || process.env.PAYMENT_PROVIDER || (isProductionRuntime() ? 'paystack' : 'mock'),
  );

  switch (resolved) {
    case 'paystack':
      return new PaystackProvider(process.env.PAYSTACK_SECRET_KEY || '');

    case 'payfast':
      return new PayfastProvider();

    case 'mock':
      if (isProductionRuntime() && !mockPaymentsAllowed()) {
        throw new Error('mock_payment_provider_disabled');
      }
      return new MockProvider();

    default:
      if (isProductionRuntime()) {
        throw new Error('invalid_payment_provider_configured');
      }
      return new MockProvider();
  }
}
