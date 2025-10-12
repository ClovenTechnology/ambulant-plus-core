// apps/patient-app/app/encounters/print/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { formatDateTime } from '../../../src/lib/date';
import { fmt2 } from '../../../src/lib/number';

const MOCK = {
  id: 'enc-001',
  ts: new Date().toISOString(),
  summary: 'Televisit â€“ cough and fever',
  notes: ['Cough 3 days', 'Temp 38.5 Â°C', 'Advised rest + fluids'],
  vitals: { hr: 88.2345, bp: '120/80', spo2: 97.8912 },
};

export default function EncounterPrintPage() {
  const sp = useSearchParams();
  const id = sp.get('id') ?? '';
  const enc = id === MOCK.id ? MOCK : null;

  if (!enc) {
    return <div className="p-6 text-gray-500">Encounter not found.</div>;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4 print:w-full print:p-0">
      <h1 className="text-2xl font-bold">Encounter Summary</h1>
      <div className="text-sm text-gray-500">{formatDateTime(new Date(enc.ts))}</div>

      <div className="p-4 border rounded bg-white space-y-3">
        <div className="font-semibold">{enc.summary}</div>
        <div className="space-y-1">
          {enc.notes.map((n, i) => (
            <div key={i} className="text-sm">â€¢ {n}</div>
          ))}
        </div>

        {enc.vitals && (
          <div className="mt-4 text-sm">
            <div>HR: {fmt2(enc.vitals.hr)} bpm</div>
            <div>BP: {enc.vitals.bp}</div>
            <div>SpOâ‚‚: {fmt2(enc.vitals.spo2)}%</div>
          </div>
        )}
      </div>

      <button
        onClick={() => window.print()}
        className="px-3 py-2 border rounded bg-emerald-600 text-white hover:bg-emerald-700 print:hidden"
      >
        Print
      </button>
    </main>
  );
}
