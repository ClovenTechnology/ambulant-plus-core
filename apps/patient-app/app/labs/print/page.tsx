// apps/patient-app/app/labs/print/page.tsx
import PrintButton from '../../../components/PrintButton'; // client component import is OK in a Server Component
import { formatDate, formatDateTime } from '../../../src/lib/date'; // use relative path to avoid alias issues
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

type LabRow = {
  id: string;
  test: string;
  value: string;
  unit?: string;
  status: 'Pending' | 'Completed';
  collected: string;
  resultAt?: string;
};

async function fetchLabs(): Promise<LabRow[]> {
  const res = await fetch(`${baseUrl()}/api/labs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function LabsPrintPage() {
  const labs = await fetchLabs();
  const now = new Date();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6 print:space-y-4">
      <header className="flex items-center justify-between print:justify-start print:gap-4">
        <h1 className="text-2xl font-bold">Lab Results</h1>
        <div className="text-sm text-gray-500">Generated: {formatDateTime(now)}</div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg">
        {labs.length === 0 ? (
          <div className="text-sm text-gray-600">No labs found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Test</th>
                <th className="py-2">Value</th>
                <th className="py-2">Status</th>
                <th className="py-2">Collected</th>
                <th className="py-2">Resulted</th>
              </tr>
            </thead>
            <tbody>
              {labs.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{l.test}</td>
                  <td className="py-2">{l.value}{l.unit ? ` ${l.unit}` : ''}</td>
                  <td className="py-2">{l.status}</td>
                  <td className="py-2">{formatDate(l.collected)}</td>
                  <td className="py-2">{l.resultAt ? formatDate(l.resultAt) : 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="text-xs text-gray-500 print:hidden">
        Use your browserâ€™s Print dialog to save as PDF.
      </footer>
    </main>
  );
}
