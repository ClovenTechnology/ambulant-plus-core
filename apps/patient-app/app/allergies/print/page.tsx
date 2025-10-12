// apps/patient-app/app/allergies/print/page.tsx
import { headers } from 'next/headers';
import PrintButton from '../../../components/PrintButton';
import { formatDate } from '../../../src/lib/date';

export const dynamic = 'force-dynamic';

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string;
};

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchAllergies(): Promise<Allergy[]> {
  const res = await fetch(`${baseUrl()}/api/allergies`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function AllergiesPrintPage() {
  const rows = await fetchAllergies();
  const now = new Date();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6 print:space-y-4">
      <header className="flex items-center justify-between print:justify-start print:gap-4">
        <h1 className="text-2xl font-bold">Allergies Summary</h1>
        <div className="text-sm text-gray-500">Generated: {formatDate(now)}</div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-600">No allergies found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Substance</th>
                <th className="py-2">Reaction</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Status</th>
                <th className="py-2">Noted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-b last:border-0 odd:bg-white even:bg-gray-50">
                  <td className="py-2 font-medium">{a.substance}</td>
                  <td className="py-2">{a.reaction}</td>
                  <td className="py-2">{a.severity}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2">{formatDate(new Date(a.notedAt))}</td>
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
