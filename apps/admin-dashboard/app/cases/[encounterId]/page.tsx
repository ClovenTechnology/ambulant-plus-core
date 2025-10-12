'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLIN } from '../../src/lib/config';

type Summary = {
  encounter: any;
  appointments: any[];
  orders: { pharmacy: any[]; lab: any[] };
  payments: any[];
};

export default function CaseOverview({ params }: { params: { encounterId: string } }) {
  const { encounterId } = params;
  const [sum, setSum] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`${CLIN}/api/summary/${encodeURIComponent(encounterId)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setSum(await r.json());
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [encounterId]);

  const cancelAppointment = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    await fetch(`${CLIN}/api/appointments/${id}/cancel`, { method: 'PUT' });
    location.reload();
  };

  const rescheduleAppointment = async (id: string) => {
    if (!confirm('Reschedule this appointment?')) return;
    const startsAt = prompt('New start time (ISO, e.g. 2025-09-08T10:00:00Z):');
    const endsAt = prompt('New end time (ISO):');
    if (!startsAt || !endsAt) return;
    await fetch(`${CLIN}/api/appointments/${id}/reschedule`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startsAt, endsAt }),
    });
    location.reload();
  };

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Case Overview</h1>
        <Link href="/orders" className="text-sm underline">Back to Orders</Link>
      </header>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}
      {err ? <div className="text-sm text-rose-600">Error: {err}</div> : null}
      {!sum ? null : (
        <>
          <section className="bg-white border rounded p-4">
            <h2 className="font-medium mb-2">Encounter</h2>
            <div className="text-sm grid md:grid-cols-2 gap-2">
              <div><span className="text-gray-500">ID:</span> {sum.encounter.id}</div>
              <div><span className="text-gray-500">Case:</span> {sum.encounter.caseId}</div>
              <div><span className="text-gray-500">Patient:</span> {sum.encounter.patientId}</div>
              <div><span className="text-gray-500">Clinician:</span> {sum.encounter.clinicianId || '-'}</div>
              <div><span className="text-gray-500">Status:</span> {sum.encounter.status}</div>
              <div><span className="text-gray-500">Updated:</span> {new Date(sum.encounter.updatedAt).toLocaleString()}</div>
            </div>
          </section>

          <section className="bg-white border rounded p-4">
            <h2 className="font-medium mb-2">Appointments</h2>
            <ul className="space-y-2 text-sm">
              {sum.appointments.map((a) => (
                <li key={a.id} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{a.status}</div>
                    <div className="text-gray-600">
                      {new Date(a.startsAt).toLocaleString()} → {new Date(a.endsAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{a.meta?.roomId || ''}</span>
                    <button
                      onClick={() => cancelAppointment(a.id)}
                      className="px-2 py-1 text-xs rounded bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => rescheduleAppointment(a.id)}
                      className="px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700"
                    >
                      Reschedule
                    </button>
                  </div>
                </li>
              ))}
              {sum.appointments.length === 0 ? <li className="text-gray-500">None</li> : null}
            </ul>
          </section>

          <section className="bg-white border rounded p-4">
            <h2 className="font-medium mb-2">Orders</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Pharmacy</h3>
                <ul className="mt-1 space-y-2 text-sm">
                  {sum.orders.pharmacy.map((o) => (
                    <li key={o.id} className="p-2 border rounded">
                      <div className="font-medium">{o.eRx?.drug || o.id}</div>
                      <div className="text-gray-600">{o.eRx?.sig || ''}</div>
                      <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
                    </li>
                  ))}
                  {sum.orders.pharmacy.length === 0 ? <li className="text-gray-500">None</li> : null}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium">Lab</h3>
                <ul className="mt-1 space-y-2 text-sm">
                  {sum.orders.lab.map((o) => (
                    <li key={o.id} className="p-2 border rounded">
                      <div className="font-medium">{o.panel || o.id}</div>
                      <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
                    </li>
                  ))}
                  {sum.orders.lab.length === 0 ? <li className="text-gray-500">None</li> : null}
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-white border rounded p-4">
            <h2 className="font-medium mb-2">Payments</h2>
            <ul className="space-y-2 text-sm">
              {sum.payments.map((p) => (
                <li key={p.id} className="p-2 border rounded flex justify-between">
                  <div>
                    <div className="font-medium">{p.status}</div>
                    <div className="text-gray-600">
                      {(p.amountCents/100).toFixed(2)} {p.currency}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                </li>
              ))}
              {sum.payments.length === 0 ? <li className="text-gray-500">None</li> : null}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
