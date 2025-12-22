// lib/payments.ts
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error('STRIPE_SECRET_KEY not set');
}

// You can swap this out for your own gateway client.
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-06-20',
});

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
};

export async function createCheckoutSession(input: CheckoutPayload) {
  const lineItems = input.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: 'zar',
      product_data: {
        name: i.name,
        metadata: {
          productId: i.productId,
        },
      },
      unit_amount: Math.round(i.unitAmountZar * 100), // cents
    },
  }));

  const session = await stripe.checkout.sessions.create({
    mode: input.mode,
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  });

  return { id: session.id, url: session.url! };
}
