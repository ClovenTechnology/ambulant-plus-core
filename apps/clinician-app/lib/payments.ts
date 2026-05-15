// apps/clinician-app/lib/payments.ts
// Paystack-only payment helper for Ambulant+ clinician checkout/EFT workflows.

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export type CheckoutItem = {
  productId: string;
  name: string;
  unitAmountZar: number;
  quantity: number;
};

export type CheckoutPayload = {
  mode: 'payment';
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  email?: string;
  customerEmail?: string;
  reference?: string;
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

function requirePaystackSecret() {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY not set');
  }

  return PAYSTACK_SECRET_KEY;
}

function calculateTotalKobo(items: CheckoutItem[]) {
  return items.reduce((sum, item) => {
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
    const unitAmountZar = Number.isFinite(item.unitAmountZar) ? item.unitAmountZar : 0;

    return sum + Math.round(unitAmountZar * 100) * quantity;
  }, 0);
}

function buildReference(input: CheckoutPayload) {
  return (
    input.reference ||
    input.metadata?.reference ||
    input.metadata?.paymentReference ||
    `amb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
}

function getCustomerEmail(input: CheckoutPayload) {
  const email =
    input.email ||
    input.customerEmail ||
    input.metadata?.email ||
    input.metadata?.customerEmail ||
    input.metadata?.clinicianEmail;

  if (!email) {
    throw new Error('Paystack checkout requires customer email');
  }

  return email;
}

export async function createCheckoutSession(input: CheckoutPayload) {
  if (input.mode !== 'payment') {
    throw new Error('Only payment mode is supported');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Checkout requires at least one item');
  }

  const amount = calculateTotalKobo(input.items);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Checkout amount must be greater than zero');
  }

  const email = getCustomerEmail(input);
  const reference = buildReference(input);
  const secret = requirePaystackSecret();

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      currency: 'ZAR',
      reference,
      callback_url: input.successUrl,
      metadata: {
        ...(input.metadata || {}),
        cancelUrl: input.cancelUrl,
        items: input.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          unitAmountZar: item.unitAmountZar,
          quantity: item.quantity,
        })),
      },
    }),
  });

  const json = (await res.json().catch(() => null)) as PaystackInitializeResponse | null;

  if (!res.ok || !json?.status || !json.data?.authorization_url) {
    throw new Error(json?.message || `Paystack checkout initialization failed (${res.status})`);
  }

  return {
    id: json.data.reference || reference,
    reference: json.data.reference || reference,
    accessCode: json.data.access_code || null,
    url: json.data.authorization_url,
    provider: 'paystack' as const,
  };
}
