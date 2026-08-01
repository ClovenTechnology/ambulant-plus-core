import Link from 'next/link';
import RecordingControls from './RecordingControls';
import TrainingRoomLaunch from './TrainingRoomLaunch';

export const dynamic = 'force-dynamic';

function trimSlash(value: string) { return String(value || '').replace(/\/+$/, ''); }
function firstParam(value: string | string[] | undefined, fallback = '') { return Array.isArray(value) ? String(value[0] || fallback) : String(value || fallback); }
function clinicianBase() { return trimSlash(process.env.NEXT_PUBLIC_CLINICIAN_APP_URL || process.env.CLINICIAN_APP_URL || 'https://clinician.ambulantplus.co.za'); }

export default function AdminTrainingRoomPage({ params, searchParams }: {
  params: { roomId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const roomId = decodeURIComponent(String(params?.roomId || ''));
  const trainingSlotId = firstParam(searchParams?.trainingSlotId, roomId);
  const requestedRole = firstParam(searchParams?.role, 'admin').toLowerCase();
  const role: 'admin' | 'trainer' | 'observer' = requestedRole === 'trainer' || requestedRole === 'observer' ? requestedRole : 'admin';
  const base = clinicianBase();
  const fallbackUrl = new URL(`/training/room/${encodeURIComponent(roomId)}`, base).toString();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">Ambulant+ Admin Training</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">Join clinician training room</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">A fresh signed admission is issued for this programme. Admins and trainers can moderate; observers join without moderation privileges.</p>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div><strong>Room:</strong> <span className="font-mono">{roomId}</span></div>
          <div className="mt-1"><strong>Training slot:</strong> <span className="font-mono">{trainingSlotId}</span></div>
          <div className="mt-1"><strong>Role:</strong> {role}</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <TrainingRoomLaunch trainingSlotId={trainingSlotId} role={role} clinicianBase={base} fallbackRoomId={roomId} />
          <Link href="/admin/training" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Back to training admin</Link>
        </div>
        {role !== 'observer' ? <RecordingControls roomId={roomId} trainingSlotId={trainingSlotId} liveRoomUrl={fallbackUrl} /> : null}
      </section>
    </main>
  );
}
