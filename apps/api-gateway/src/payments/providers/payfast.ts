import {
  PaymentProvider,
  InitializeCheckoutInput,
  InitializeCheckoutResult,
  VerifyCheckoutResult,
  RefundResult,
} from '../provider';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function payfastProcessUrl() {
  return trimSlash(process.env.PAYFAST_PROCESS_URL || 'https://www.payfast.co.za/eng/process');
}

function payfastMerchantId() {
  return process.env.PAYFAST_MERCHANT_ID || '';
}

function payfastMerchantKey() {
  return process.env.PAYFAST_MERCHANT_KEY || '';
}

function buildPayfastRedirect(input: InitializeCheckoutInput) {
  const params = new URLSearchParams();

  params.set('merchant_id', payfastMerchantId());
  params.set('merchant_key', payfastMerchantKey());
  params.set('amount', (input.amountCents / 100).toFixed(2));
  params.set('item_name', `Appointment ${input.reference}`);
  params.set('m_payment_id', input.reference);
  params.set('email_address', input.email);

  if (input.callbackUrl) {
    params.set('return_url', input.callbackUrl);
  }
  if (process.env.PAYFAST_CANCEL_URL) {
    params.set('cancel_url', process.env.PAYFAST_CANCEL_URL);
  }
  if (process.env.PAYFAST_NOTIFY_URL) {
    params.set('notify_url', process.env.PAYFAST_NOTIFY_URL);
  }

  return `${payfastProcessUrl()}?${params.toString()}`;
}

export class PayfastProvider implements PaymentProvider {
  async initializeCheckout(input: InitializeCheckoutInput): Promise<InitializeCheckoutResult> {
    const redirectUrl = buildPayfastRedirect(input);

    return {
      provider: 'payfast',
      reference: input.reference,
      status: 'pending_redirect',
      redirectUrl,
      raw: {
        merchantIdConfigured: Boolean(payfastMerchantId()),
        merchantKeyConfigured: Boolean(payfastMerchantKey()),
      },
    };
  }

  async verifyCheckout(reference: string): Promise<VerifyCheckoutResult> {
    return {
      provider: 'payfast',
      reference,
      status: 'pending',
      raw: {
        note: 'PayFast verification should be concluded through ITN/notify flow.',
      },
    };
  }

  async refund(providerRef: string, amountCents?: number): Promise<RefundResult> {
    return {
      providerRef,
      status: 'failed',
      meta: {
        note: 'Refund flow not yet implemented for PayFast.',
        amountCents,
      },
    };
  }
}