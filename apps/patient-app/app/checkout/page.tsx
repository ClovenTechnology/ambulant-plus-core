// apps/patient-app/app/checkout/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import MedicalAidManager from '@/components/MedicalAidManager';

type Appt = {
  id: string;
  startISO: string;
  endISO: string;
  status?: string;
  priceZAR?: number;
  clinicianId: string;
};

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo';

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('a') || '';

  const [a, setA] = useState<Appt | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Default payment method = self-pay card (as requested)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('self-pay-card');
  const [voucherCode, setVoucherCode] = useState('');

  // Optional: show voucher redeem result (nice UX)
  const [voucherHint, setVoucherHint] = useState<string>('');

  // For this demo we use a fixed patientId; in real auth we'd read it from the session/profile.
  const patientId = 'pt-za-001';

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/appointments/${id}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('Failed to load appointment');
        setA(await r.json());
      } catch (e: any) {
        setErr(e?.message || 'Failed to load appointment');
      }
    })();
  }, [id]);

  const buttonLabel = useMemo(() => {
    if (busy) return 'Processing…';
    if (paymentMethod === 'medical-aid') return 'Confirm (Claim via Medical Aid)';
    if (paymentMethod === 'voucher-promo') return 'Redeem & Confirm';
    return 'Pay & Confirm';
  }, [busy, paymentMethod]);

  async function pay() {
    if (!id) return;

    const trimmedVoucher = voucherCode.trim();

    // Basic client-side guard for voucher mode
    if (paymentMethod === 'voucher-promo' && !trimmedVoucher) {
      setErr('Please enter a voucher/promo code.');
      return;
    }

    setBusy(true);
    setErr('');
    setVoucherHint('');
    try {
      // ✅ Voucher mode: send only these three fields
      const body =
        paymentMethod === 'voucher-promo'
          ? {
              appointmentId: id,
              paymentMethod: 'voucher-promo' as const,
              voucherCode: trimmedVoucher,
            }
          : {
              appointmentId: id,
              paymentMethod, // 'self-pay-card' | 'medical-aid'
            };

      const r = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        // show gateway-provided error message when voucher redeem fails
        const js = await r.json().catch(() => null);
        throw new Error(js?.error || 'Failed to confirm');
      }

      // Optional: if confirm returns extra info, surface it briefly
      const js = await r.json().catch(() => null);
      if (paymentMethod === 'voucher-promo') {
        const cents = js?.appointment?.funding?.amountZAR
          ? Math.round(Number(js.appointment.funding.amountZAR) * 100)
          : null;
        setVoucherHint(
          js?.voucher?.code
            ? `Voucher ${js.voucher.code} redeemed.`
            : cents !== null
            ? 'Voucher redeemed.'
            : 'Voucher redeemed.',
        );
      }

      router.replace(`/checkout/success?a=${id}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to confirm');
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="text-rose-600">Missing appointment id.</div>
        <Link href="/appointments" className="text-sm underline block mt-2">
          ← Back to appointments
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      {err && <div className="text-rose-600 text-sm">{err}</div>}
      {voucherHint && !err && (
        <div className="text-emerald-700 text-sm">{voucherHint}</div>
      )}

      {a ? (
        <section className="bg-white rounded-lg border p-5 space-y-4">
          <div className="text-sm space-y-1">
            <div>
              <strong>Appointment:</strong> {a.id}
            </div>
            <div>
              <strong>When:</strong> {new Date(a.startISO).toLocaleString()} —{' '}
              {new Date(a.endISO).toLocaleTimeString()}
            </div>
            <div>
              <strong>Status:</strong> {a.status || 'booked'}
            </div>
            <div className="text-lg font-medium mt-2">
              Total: R {(a.priceZAR ?? 0).toFixed(2)}
            </div>
          </div>

          {/* Payment method selection */}
          <section className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <div className="text-sm font-medium text-gray-800">Payment method</div>
            <div className="text-xs text-gray-600">
              Choose how you want this consultation to be funded.
            </div>

            <div className="mt-2 grid gap-2 text-sm">
              <label className="flex items-start gap-2 rounded border bg-white px-3 py-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="self-pay-card"
                  checked={paymentMethod === 'self-pay-card'}
                  onChange={() => {
                    setPaymentMethod('self-pay-card');
                    setVoucherHint('');
                  }}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">Self-pay (Card)</div>
                  <div className="text-xs text-gray-600">
                    Pay now via card. (Calls API gateway <code>/api/payments</code>)
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2 rounded border bg-white px-3 py-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="medical-aid"
                  checked={paymentMethod === 'medical-aid'}
                  onChange={() => {
                    setPaymentMethod('medical-aid');
                    setVoucherHint('');
                  }}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">Medical Aid / Insurance</div>
                  <div className="text-xs text-gray-600">
                    No card charge now. Appointment is confirmed and marked “to be claimed”.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2 rounded border bg-white px-3 py-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="voucher-promo"
                  checked={paymentMethod === 'voucher-promo'}
                  onChange={() => {
                    setPaymentMethod('voucher-promo');
                    setVoucherHint('');
                  }}
                  className="mt-1"
                />
                <div className="w-full">
                  <div className="font-medium text-gray-900">Voucher / Promo</div>
                  <div className="text-xs text-gray-600">
                    Confirm using a redeemable voucher or promo token (validated by API gateway).
                  </div>

                  {paymentMethod === 'voucher-promo' && (
                    <div className="mt-2">
                      <label className="text-[11px] text-gray-600 block mb-1">
                        Voucher / promo code
                      </label>
                      <input
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="e.g. AMBULANT-2025-FREECONSULT"
                        className="w-full border rounded px-2 py-1 text-sm"
                        autoComplete="off"
                        inputMode="text"
                      />
                      <div className="mt-1 text-[11px] text-gray-500">
                        We’ll redeem + mark used via <code>/api/vouchers/redeem</code>.
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </section>

          {/* Tiny Medical Aid section reusing same list + modal */}
          <MedicalAidManager patientId={patientId} compact />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={pay}
              disabled={busy || (paymentMethod === 'voucher-promo' && !voucherCode.trim())}
              className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
            >
              {buttonLabel}
            </button>
            <Link href="/appointments" className="px-4 py-2 rounded border">
              ← Back to appointments
            </Link>
          </div>
        </section>
      ) : (
        <div>Loading…</div>
      )}
    </main>
  );
}
