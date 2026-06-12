import Link from 'next/link';
import RecordingControls from './RecordingControls';

export const dynamic = 'force-dynamic';

function trimSlash(v: string) {
  return String(v || '').replace(/\/+$/, '');
}

function firstParam(v: string | string[] | undefined, fallback = '') {
  if (Array.isArray(v)) return String(v[0] || fallback);
  return String(v || fallback);
}

function clinicianBase() {
  return trimSlash(
    process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
      process.env.CLINICIAN_APP_URL ||
      'https://clinician.ambulantplus.co.za',
  );
}

export default function AdminTrainingRoomPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const roomId = decodeURIComponent(String(params?.roomId || ''));
  const trainingSlotId = firstParam(searchParams?.trainingSlotId, roomId);
  const role = firstParam(searchParams?.role, 'admin') === 'trainer' ? 'trainer' : 'admin';
  const uid = firstParam(searchParams?.uid, `training-${role}-admin-dashboard`);

  const url = new URL(`/training/room/${encodeURIComponent(roomId)}`, clinicianBase());
  url.searchParams.set('trainingSlotId', trainingSlotId);
  url.searchParams.set('role', role);
  url.searchParams.set('uid', uid);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">
          Ambulant+ Admin Training
        </p>

        <h1 className="mt-3 text-2xl font-black text-slate-950">
          Join clinician training room
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This controls the same LiveKit cohort room used by clinicians. Use this path for trainer-led orientation, attendance observation, recording control, and certification evidence review.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div><strong>Room:</strong> <span className="font-mono">{roomId}</span></div>
          <div className="mt-1"><strong>Training slot:</strong> <span className="font-mono">{trainingSlotId}</span></div>
          <div className="mt-1"><strong>Role:</strong> {role}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={url.toString()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700"
          >
            Open live training room
          </a>

          <Link
            href="/admin/training"
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Back to training admin
          </Link>
        </div>

        <RecordingControls
          roomId={roomId}
          trainingSlotId={trainingSlotId}
          liveRoomUrl={url.toString()}
        />
      </section>
    </main>
  );
}
