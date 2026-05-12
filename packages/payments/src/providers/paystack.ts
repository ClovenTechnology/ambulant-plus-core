export type PaystackChargeParams = {
  amount_cents: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
};

export type PaystackChargeResult = {
  provider: 'paystack';
  payment_ref: string;
  redirect_url: string | null;
};

/**
 * Compile-safe stub for Paystack charge/init.
 * Replace with real Paystack API later.
 */
export async function paystackCharge(
  params: PaystackChargeParams,
  _customerEmail: string,
): Promise<PaystackChargeResult> {
  const payment_ref = params.idempotencyKey ?? `ps_${Date.now()}`;

  // In a real integration, redirect_url would be Paystack authorization_url
  return {
    provider: 'paystack',
    payment_ref,
    redirect_url: null,
  };
}
