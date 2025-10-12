// apps/patient-app/app/encounters/[id]/print/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import PrintButton from '../../../../components/PrintButton';
import { formatDate, formatDateTime } from '../../../../src/lib/date';
import { fmt2 } from '../../../../src/lib/number';

type Note = { id: string; ts: string; text: string; source?: string };
type Encounter = {
  id: string;
  status: 'Triage' | 'Consult' | 'Completed';
  startedAt: string;
  updatedAt: string;
  summary?: string;
  notes: Note[];
  hr?: number; sys?: number; dia?: number; spo2?: number; temp_c?: number;
};

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchOne(id: string): Promise<Encounter | null> {
  const r1 = await fetch(`${baseUrl()}/api/encounters/${id}`, { cache: 'no-store' }).catch(() => null);
  if (r1 && r1.ok) return r1.json();

  const r2 = await fetch(`${baseUrl()}/api/encounters`, { cache: 'no-store' }).catch(() => null);
  if (!r2 || !r2.ok) return null;
  const list: Encounter[] = await r2.json();
  return list.find(e => e.id === id) ?? null;
}

export const dynamic = 'force-dynamic';

export default async function EncounterPrint({ params }: { params: { id: string } }) {
  const e = await fetchOne(params.id);
  if (!e) notFound();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6 print:space-y-4">
      <header className="flex items-center justify-between print:justify-start print:gap-4">
        <div>
          <h1 className="text-2xl font-bold">Encounter Summary</h1>
          <div className="text-sm text-gray-500">
            ID {e.id} • Updated {formatDateTime(e.updatedAt)} • Started {formatDate(e.startedAt)}
          </div>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      <section className="p-4 bg-white border rounded">
        <h2 className="font-semibold mb-2">Snapshot</h2>
        <div className="text-sm">
          <span className="mr-2">Status: {e.status}</span>
          {typeof e.hr === 'number' && (
            <span className="text-gray-600">
              • HR {fmt2(e.hr)} bpm
              {typeof e.sys === 'number' && typeof e.dia === 'number' ? (
                <> • BP {fmt2(e.sys)}/{fmt2(e.dia)} mmHg</>
              ) : null}
              {typeof e.spo2 === 'number' ? <> • SpO₂ {fmt2(e.spo2)} %</> : null}
              {typeof e.temp_c === 'number' ? <> • Temp {fmt2(e.temp_c)} °C</> : null}
            </span>
          )}
        </div>
        {e.summary && <div className="mt-2 text-sm">{e.summary}</div>}
      </section>

      <section className="p-4 bg-white border rounded">
        <h2 className="font-semibold mb-2">Notes</h2>
        {e.notes?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Date</th>
                <th className="py-2">Source</th>
                <th className="py-2">Text</th>
              </tr>
            </thead>
            <tbody>
              {e.notes.map(n => (
                <tr key={n.id} className="border-b last:border-0 align-top">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(n.ts)}</td>
                  <td className="py-2">{n.source ?? '—'}</td>
                  <td className="py-2 whitespace-pre-wrap">{n.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-gray-500">No notes.</div>
        )}
      </section>

      <footer className="text-xs text-gray-500 print:hidden">
        Use your browser’s Print dialog to save as PDF.
      </footer>
    </main>
  );
}
