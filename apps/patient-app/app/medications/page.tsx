'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDate } from '../../src/lib/date';

type Medication = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  started: string;
  lastFilled: string;
  status: 'Active' | 'Completed' | 'On Hold';
  orderId?: string; // â† needed for the chip
};

export default function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/medications', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        setMeds(await res.json());
      } catch {
        setMeds([]);
      }
    })();
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Medications</h1>
        <Link
          href="/medications/print"
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
        >
          Print Medications
        </Link>
      </header>

      <section className="p-4 bg-white border rounded-lg">
        {meds.length === 0 ? (
          <div className="text-sm text-gray-600">No medications listed.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Dose</th>
                <th className="py-2">Frequency</th>
                <th className="py-2">Route</th>
                <th className="py-2">Started</th>
                <th className="py-2">Last Filled</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  {/* Name cell with chip (single <td/>) */}
                  <td className="py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {m.name}
                      {m.orderId && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Relates to Order
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2">{m.dose}</td>
                  <td className="py-2">{m.frequency}</td>
                  <td className="py-2">{m.route}</td>
                  <td className="py-2">{formatDate(m.started)}</td>
                  <td className="py-2">{formatDate(m.lastFilled)}</td>
                  <td className="py-2">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
