import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncVerifiedPaymentToAppointment } from '@/src/payments/payment-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rawBodySignatureValid(raw: string, secret: string, signature: string | null) {
  if (!signature) return false;
  const digest = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  return digest === signature;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    if (!secret) {
      return NextResponse.json({ ok: false, error: 'missing_paystack_secret' }, { status: 500 });
    }

    const raw = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!rawBodySignatureValid(raw, secret, signature)) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as any;
    const eventType = String(event?.event || '');

    if (eventType !== 'charge.success') {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const data = event?.data || {};
    const reference = String(data?.reference || '').trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: 'missing_reference' }, { status: 400 });
    }

    await syncVerifiedPaymentToAppointment({
      reference,
      provider: 'paystack',
      state: 'captured',
      amountCents:
        typeof data?.amount === 'number' ? data.amount : Number(data?.amount || 0),
      currency: typeof data?.currency === 'string' ? data.currency : 'ZAR',
      raw: event,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'paystack_webhook_failed' },
      { status: 400 },
    );
  }
}