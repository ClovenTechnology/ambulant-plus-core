// apps/patient-app/app/encounters/[id]/page.tsx
type Encounter = {
  id: string;
  case: string;
  startedAt: number;
  status: 'Open' | 'Closed' | 'In Review';
  summary: string;
  patientName: string;
  vitals?: Array<{ t: number; hr: number; spo2: number; temp: number }>;
};

export const dynamic = 'force-dynamic';

export default async function EncounterDetailPage({
  params,
}: { params: { id: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/encounters/${params.id}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return (
      <main className="p-6">
        <div className="rounded-xl border p-4 bg-white">Encounter not found.</div>
      </main>
    );
  }
  const e = (await res.json()) as Encounter;

  return (
    <main className="p-6">
      <div className="rounded-2xl border p-6 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-neutral-500">{e.patientName}</div>
            <h1 className="text-xl font-semibold">{e.case}</h1>
          </div>
          <div className="text-right text-sm text-neutral-600">
            <div>Started: {new Date(e.startedAt).toLocaleString()}</div>
            <div>Status: <span className="font-medium">{e.status}</span></div>
          </div>
        </div>
        <p className="mt-4 text-neutral-700">{e.summary}</p>

        <div className="mt-6">
          <h2 className="font-medium mb-2">Recent vitals (last 20 samples)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">HR</th>
                  <th className="py-2 pr-4">SpO₂</th>
                  <th className="py-2 pr-4">Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                {e.vitals?.map((v) => (
                  <tr key={v.t} className="border-t">
                    <td className="py-2 pr-4 font-mono">{new Date(v.t).toLocaleString()}</td>
                    <td className="py-2 pr-4">{v.hr}</td>
                    <td className="py-2 pr-4">{v.spo2}</td>
                    <td className="py-2 pr-4">{v.temp.toFixed(1)}</td>
                  </tr>
                )) ?? (
                  <tr><td className="py-2 text-neutral-600">No vitals.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
