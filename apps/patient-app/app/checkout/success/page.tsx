'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CheckoutSuccess() {
  const sp = useSearchParams();
  const id = sp.get('a') || '';

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Payment successful</h1>
      <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-emerald-900">
        Appointment <code>{id}</code> is confirmed and paid.
      </div>
      <div className="text-sm flex gap-4">
        <Link href={`/appointments/${id}`} className="underline">View appointment</Link>
        <a href={`/api/appointments/${id}/ics`} className="underline">Download .ics</a>
        <Link href="/appointments" className="underline">All appointments</Link>
      </div>
    </main>
  );
}
