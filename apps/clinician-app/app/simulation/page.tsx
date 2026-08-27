'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Session = {
  appointmentId: string; roomId?: string | null; startsAt: string; endsAt: string; status: string;
  reason?: string | null; sessionNumber?: number | null; patientName?: string; scenario?: string | null;
  expectedIoMTs?: string[]; supervisor?: { name?: string; mode?: string };
  assessment?: { status?: string; outcome?: string | null; finalizedAt?: string | null } | null; passed?: boolean;
};
function human(value: unknown) { return String(value || '').replace(/_/g, ' '); }
export default function SimulationWorkspace() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/simulation', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load simulations');
    setData(body);
  }, []);
  useEffect(() => { void load().catch((e) => setNotice(human(e?.message))); }, [load]);
  const sessions: Session[] = Array.isArray(data?.sessions) ? data.sessions : [];
  const upcoming = useMemo(() => sessions.filter((s) => new Date(s.endsAt).getTime() >= Date.now()), [sessions]);
  async function enter(session: Session) {
    setBusy(session.appointmentId); setNotice('');
    try {
      const response = await fetch('/api/simulation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appointmentId: session.appointmentId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.admission?.token) throw new Error(body?.error || 'Admission unavailable');
      const a = body.admission;
      const query = new URLSearchParams({ appointmentId: a.appointmentId, visitId: a.visitId, participantId: a.participantId, uid: a.participantId, participantRole: 'clinician', role: 'clinician', joinToken: a.token, jt: a.token, simulation: '1' });
      window.location.assign(`/sfu/${encodeURIComponent(a.roomId)}?${query.toString()}`);
    } catch (e: any) { setNotice(human(e?.message)); setBusy(''); }
  }
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Clinical readiness</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-black">Simulation workspace</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Supervised, no-charge contactless consultations before real-patient activation.</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm"><b>{data?.passedCount || 0}/3</b> qualifying passes · {data?.progress || 0}%</div>
          </div>
        </header>
        {notice ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{notice}</div> : null}
        <section className="grid gap-4 lg:grid-cols-2">
          {(upcoming.length ? upcoming : sessions).map((session) => (
            <article key={session.appointmentId} className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">Session {session.sessionNumber || '—'}</span><h2 className="mt-3 text-xl font-black text-slate-950">{session.patientName || 'Simulation patient'}</h2></div><span className="text-xs font-bold text-slate-500">{human(session.status)}</span></div>
              <p className="mt-3 text-sm text-slate-600">{new Date(session.startsAt).toLocaleString()} · {Math.max(1, Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60000))} min</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><div><b>Supervisor:</b> {session.supervisor?.name || 'Assigned'} · {session.supervisor?.mode || 'OBSERVE'}</div>{session.scenario ? <div className="mt-2"><b>Scenario:</b> {session.scenario}</div> : null}{session.expectedIoMTs?.length ? <div className="mt-2"><b>Expected IoMTs:</b> {session.expectedIoMTs.join(', ')}</div> : null}</div>
              <div className="mt-4 flex items-center justify-between gap-3"><div className="text-xs text-slate-500">Assessment: {session.assessment?.status ? `${human(session.assessment.status)}${session.assessment.outcome ? ` · ${human(session.assessment.outcome)}` : ''}` : 'Pending'}</div><button type="button" disabled={busy === session.appointmentId} onClick={() => void enter(session)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy === session.appointmentId ? 'Preparing…' : 'Enter simulation'}</button></div>
            </article>
          ))}
        </section>
        {!sessions.length ? <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-600">No simulation session has been scheduled yet.</div> : null}
      </div>
    </main>
  );
}
