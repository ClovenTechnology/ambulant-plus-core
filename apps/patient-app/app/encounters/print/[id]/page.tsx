// apps/patient-app/app/encounters/print/[id]/page.tsx
import { headers } from 'next/headers';
import PrintButton from '../../../../components/PrintButton';
import { formatDateTime } from '../../../../src/lib/date';

type Encounter = {
  id: string; ts: string; source?: string; visitId?: string; text: string;
};

export const dynamic = 'force-dynamic';

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchEncounter(id: string): Promise<Encounter | null> {
  const res = await fetch(`${baseUrl()}/api/encounters`, { cache: 'no-store' });
  if (!res.ok) return null;
  const all: Encounter[] = await res.json();
  return all.find(e => e.id === id) ?? null;
}

export default async function EncounterPrintPage({ params }: { params: { id: string } }) {
  const enc = await fetchEncounter(params.id);
  const now = new Date();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6 print:space-y-4">
      <header className="flex items-center justify-between print:justify-start print:gap-6">
        <div>
          <h1 className="text-2xl font-bold">Encounter Summary</h1>
          <div className="text-sm text-gray-500">Generated: {formatDateTime(now)}</div>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      {!enc ? (
        <section className="p-4 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">Encounter not found.</div>
        </section>
      ) : (
        <section className="p-4 bg-white border rounded-lg space-y-2">
          <div className="text-sm text-gray-500">{enc.source ? enc.source.toUpperCase() : 'Encounter'}</div>
          <div className="font-medium">{formatDateTime(new Date(enc.ts))}</div>
          {enc.visitId && <div className="text-sm text-gray-500">Visit: {enc.visitId}</div>}
          <div className="mt-3 whitespace-pre-wrap">{enc.text}</div>
        </section>
      )}

      <footer className="text-xs text-gray-500 print:hidden">
        Use your browser’s Print dialog to save as PDF.
      </footer>
    </main>
  );
}
