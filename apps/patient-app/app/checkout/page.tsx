'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Appt = { id: string; startISO: string; endISO: string; status?: string; priceZAR?: number; clinicianId: string };

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('a') || '';
  const [a, setA] = useState<Appt | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function pay() {
    if (!id) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id }),
      });
      if (!r.ok) throw new Error('Failed to confirm');
      // redirect to success page
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
        <Link href="/appointments" className="text-sm underline block mt-2">â† Back to appointments</Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      {err && <div className="text-rose-600">{err}</div>}

      {a ? (
        <section className="bg-white rounded-lg border p-5">
          <div className="text-sm space-y-1">
            <div><strong>Appointment:</strong> {a.id}</div>
            <div>
              <strong>When:</strong> {new Date(a.startISO).toLocaleString()} â€” {new Date(a.endISO).toLocaleTimeString()}
            </div>
            <div><strong>Status:</strong> {a.status || 'booked'}</div>
            <div className="text-lg font-medium mt-2">
              Total: R {(a.priceZAR ?? 0).toFixed(2)}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={pay} disabled={busy} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
              {busy ? 'Processingâ€¦' : 'Pay & Confirm'}
            </button>
            <Link href="/appointments" className="px-4 py-2 rounded border">â† Back to appointments</Link>
          </div>
        </section>
      ) : (
        <div>Loadingâ€¦</div>
      )}
    </main>
  );
}
