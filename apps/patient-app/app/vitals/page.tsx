// apps/patient-app/app/vitals/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmt2 } from '../../src/lib/number';
import { formatDateTime } from '../../src/lib/date';

type Vital = {
  id: string;
  ts: string;        // ISO
  hr?: number;       // bpm
  sys?: number;      // mmHg
  dia?: number;      // mmHg
  spo2?: number;     // %
  temp_c?: number;   // °C
  bmi?: number;
};

export default function VitalsPage() {
  const [rows, setRows] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/vitals', { cache: 'no-store' });
        if (!r.ok) throw new Error();
        setRows(await r.json());
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vitals</h1>
        <div className="flex gap-2">
          <Link
            href="/charts"
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
          >
            Live Charts
          </Link>
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg overflow-x-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading..¦</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">No vitals recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2">Collected</th>
                <th className="py-2 pr-2">HR (bpm)</th>
                <th className="py-2 pr-2">BP (mmHg)</th>
                <th className="py-2 pr-2">SpO2‚‚ (%)</th>
                <th className="py-2 pr-2">Temp (°C)</th>
                <th className="py-2 pr-2">BMI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">{formatDateTime(v.ts)}</td>
                  <td className="py-2 pr-2">{fmt2(v.hr)}</td>
                  <td className="py-2 pr-2">
                    {fmt2(v.sys)}/{fmt2(v.dia)}
                  </td>
                  <td className="py-2 pr-2">{fmt2(v.spo2)}</td>
                  <td className="py-2 pr-2">{fmt2(v.temp_c)}</td>
                  <td className="py-2 pr-2">{fmt2(v.bmi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
