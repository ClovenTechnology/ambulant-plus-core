import { NextRequest, NextResponse } from 'next/server';
import { verifyCheckout } from '@/src/payments/checkout-core';
import { syncVerifiedPaymentToAppointment } from '@/src/payments/payment-sync';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const reference =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref') ||
      url.searchParams.get('paymentRef') ||
      '';

    if (!reference.trim()) {
      return NextResponse.json({ ok: false, error: 'reference_required' }, { status: 400 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { paymentRef: reference.trim() },
    });

    function payableAmountMinor(appointment: any) {
  const copay = Number(appointment?.patientCopayMinor ?? 0);
  const price = Number(appointment?.priceCents ?? appointment?.amountMinor ?? appointment?.totalMinor ?? 0);

  if (Number.isFinite(copay) && copay > 0) return Math.round(copay);
  if (Number.isFinite(price) && price > 0) return Math.round(price);

  return 0;
}

const expectedAmountCents = payableAmountMinor(appointment);
const expectedCurrency = appointment?.currency ?? 'ZAR';

    const verified = await verifyCheckout({
      provider: 'paystack',
      reference: reference.trim(),
      expectedAmountCents,
      expectedCurrency,
    });

    const synced = await syncVerifiedPaymentToAppointment({
      reference: reference.trim(),
      provider: 'paystack',
      state: verified.status,
      amountCents: verified.amountCents,
      currency: verified.currency,
      raw: (verified.raw as Record<string, unknown>) || null,
    });

    return NextResponse.json(
      {
        ok: true,
        verification: verified,
        appointmentId: synced.appointment?.id ?? null,
        paymentId: synced.payment.id,
        redirect:
          verified.status === 'captured'
            ? `/appointments/${encodeURIComponent(synced.appointment?.id || '')}?payment=success`
            : `/appointments/${encodeURIComponent(synced.appointment?.id || '')}?payment=${encodeURIComponent(verified.status)}`,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'payment_verify_failed' },
      { status: 400 },
    );
  }
}