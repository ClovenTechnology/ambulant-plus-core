// apps/patient-app/app/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import cleanText from '@/lib/cleanText';
import { CLINICIANS } from '@/mock/clinicians'; // for demo "Recent Encounters" text, etc.

export default async function Home() {
  // Demo-only: sanitize any text we show here that comes from mock data
  const demoClin = CLINICIANS.slice(0, 2).map(c => ({
    ...c,
    name: cleanText(c.name),
    specialty: cleanText(c.specialty),
    location: cleanText(c.location),
  }));

  return (
    <main className="p-6 space-y-6">
      <section className="bg-white border rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">Welcome to Ambulant+</h1>
        <p className="text-gray-600 mt-2">
          Your connected health companion. Track vitals, start a guided triage, manage care, and stay in sync with
          your clinicians.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/auto-triage" className="px-3 py-1.5 rounded bg-emerald-600 text-white">Auto Triage</Link>
          <Link href="/myCare" className="px-3 py-1.5 rounded bg-indigo-600 text-white">myCare</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="border rounded bg-white p-4">
          <div className="font-medium mb-2">Latest Vitals</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Heart Rate</span><span className="font-semibold">72 bpm</span></div>
            <div className="flex justify-between"><span>Blood Pressure</span><span className="font-semibold">120/80</span></div>
            <div className="flex justify-between"><span>Temperature</span><span className="font-semibold">36.80 °C</span></div>
            <div className="flex justify-between"><span>SpO₂</span><span className="font-semibold">98%</span></div>
          </div>
        </div>

        <div className="border rounded bg-white p-4">
          <div className="font-medium mb-2">Recent Encounters</div>
          <ul className="text-sm space-y-2">
            <li>
              {cleanText('2025-08-01 – General Checkup')}
              <Link href="#" className="ml-2 text-indigo-700 underline">View</Link>
            </li>
            <li>
              {cleanText('2025-08-05 – Follow-up on Hypertension')}
              <Link href="#" className="ml-2 text-indigo-700 underline">View</Link>
            </li>
            <li>
              {cleanText('2025-08-10 – Chest Pain')}
              <Link href="#" className="ml-2 text-indigo-700 underline">View</Link>
            </li>
          </ul>
        </div>

        <div className="border rounded bg-white p-4">
          <div className="font-medium mb-2">Recent Reports</div>
          <ul className="text-sm space-y-2">
            <li>Blood Test Results.pdf <span className="text-gray-500 ml-2">2025-08-10</span></li>
            <li>Chest X-Ray.png <span className="text-gray-500 ml-2">2025-07-28</span></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
