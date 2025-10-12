// apps/patient-app/app/medications/print/page.tsx
import { headers } from 'next/headers';
import PrintButton from '../../../components/PrintButton'; 
import { formatDate, formatDateTime } from '../../../src/lib/date'; 

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export const dynamic = 'force-dynamic';

type Medication = {
  id: string; name: string; dose: string; frequency: string; route: string;
  started: string; lastFilled: string; status: 'Active' | 'Completed' | 'On Hold';
};

async function fetchMeds(): Promise<Medication[]> {
  const res = await fetch(`${baseUrl()}/api/medications`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function MedicationsPrintPage() {
  const meds = await fetchMeds();
  const now = new Date();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6 print:space-y-4">
      <header className="flex items-center justify-between print:justify-start print:gap-4">
        <h1 className="text-2xl font-bold">Medication List</h1>
        <div className="text-sm text-gray-500">Generated: {formatDateTime(now)}</div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg">
        {meds.length === 0 ? (
          <div className="text-sm text-gray-600">No medications found.</div>
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
              {meds.map(m => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{m.name}</td>
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

      <footer className="text-xs text-gray-500 print:hidden">
        Use your browserâ€™s Print dialog to save as PDF.
      </footer>
    </main>
  );
}
