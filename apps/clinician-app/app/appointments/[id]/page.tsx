export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { headers } from 'next/headers';

type Appt = {
  id: string;
  when: string;
  patientName: string;
  clinicianName: string;
  reason: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  roomId: string;
};

function abs(path: string) {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host')!;
  return `${proto}://${host}${path}`;
}

async function load(id: string): Promise<Appt | null> {
  const res = await fetch(abs(`/api/appointments/${id}`), { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function Page({ params }: { params: { id: string } }) {
  const appt = await load(params.id);
  if (!appt) return <main className="p-6">Not found.</main>;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Appointment {appt.id}</h1>
      <div className="text-sm grid md:grid-cols-2 gap-2 border rounded p-4 bg-white">
        <div><span className="opacity-60">When:</span> {new Date(appt.when).toLocaleString()}</div>
        <div><span className="opacity-60">Patient:</span> {appt.patientName}</div>
        <div><span className="opacity-60">Clinician:</span> {appt.clinicianName}</div>
        <div><span className="opacity-60">Reason:</span> {appt.reason}</div>
        <div><span className="opacity-60">Status:</span> {appt.status}</div>
      </div>
      <div className="flex gap-3">
        <Link className="border rounded px-3 py-1" href={`/sfu/${appt.roomId}`}>Join Televisit</Link>
        <Link className="underline text-sm self-center" href="/appointments">← Back</Link>
      </div>
    </main>
  );
}
