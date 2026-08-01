import Link from 'next/link';
import PatientTrainingManager from './PatientTrainingManager';

export const dynamic = 'force-dynamic';

export default function TrainingPatientsPage({
  searchParams,
}: {
  searchParams?: { slotId?: string | string[] };
}) {
  const raw = searchParams?.slotId;
  const slotId = Array.isArray(raw) ? raw[0] || '' : raw || '';

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Training participants</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Manage patient invitations</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Invite patients before a programme begins or add them later while the slot is still active. Patients must accept the invitation and consent before joining or sharing IoMT readings.
              </p>
            </div>
            <Link href="/admin/training" className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Back to training control
            </Link>
          </div>
        </header>
        <PatientTrainingManager initialSlotId={slotId} />
      </div>
    </main>
  );
}
