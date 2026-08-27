'use client';

import { useCallback, useEffect, useState } from 'react';

type Simulation = {
  appointmentId: string; roomId?: string | null; startsAt: string; endsAt: string; status: string;
  reason?: string | null; sessionNumber?: number | null; clinicianName?: string;
  supervisor?: { name?: string; mode?: string }; paymentStatus?: string; noCharge?: boolean;
};
function human(value: unknown) { const text = String(value || '').replace(/_/g, ' '); return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Request failed'; }
function rememberAdmission(a: any) {
  if (typeof window === 'undefined' || !a?.token) return;
  const keys = [
    `televisit_join_${a.visitId}`, `televisit_join_${a.roomId}`,
    `televisit:join:${a.visitId}`, `televisit:join:${a.roomId}`,
    `televisitJoin:${a.visitId}`, `rtc:join:${a.visitId}`,
    `joinJwt:${a.visitId}`, `ambulant.televisit.join.${a.visitId}`,
  ];
  for (const key of keys) window.sessionStorage.setItem(key, a.token);
}

export default function PatientSimulationSessions() {
  const [sessions, setSessions] = useState<Simulation[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch('/api/simulation', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load simulation sessions');
    setSessions(Array.isArray(body?.sessions) ? body.sessions : []);
  }, []);
  useEffect(() => { void load().catch((e) => setNotice({ tone: 'err', text: human(e?.message) })); }, [load]);

  async function enter(session: Simulation) {
    setBusy(session.appointmentId); setNotice(null);
    try {
      const response = await fetch('/api/simulation', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appointmentId: session.appointmentId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.admission?.token) throw new Error(body?.error || 'Simulation admission unavailable');
      const a = body.admission;
      rememberAdmission(a);
      const query = new URLSearchParams({
        appointmentId: a.appointmentId,
        visitId: a.visitId,
        participantId: a.participantId,
        participantRole: 'patient',
        simulation: '1',
      });
      window.location.assign(`/lobby?${query.toString()}`);
    } catch (error: any) {
      setNotice({ tone: 'err', text: human(error?.message) });
      setBusy('');
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <div className={`rounded-2xl border p-4 text-sm ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{notice.text}</div> : null}
      {sessions.length ? sessions.map((session) => (
        <article key={session.appointmentId} className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase text-indigo-700">Simulation {session.sessionNumber || ''}</span><h2 className="mt-3 text-xl font-black text-slate-950">{session.clinicianName || 'Clinician'}</h2><p className="mt-1 text-sm text-slate-600">{session.reason || 'Supervised contactless medicine simulation.'}</p></div>
            <div className="text-sm text-slate-600 sm:text-right"><div className="font-bold text-slate-900">{new Date(session.startsAt).toLocaleString()}</div><div>{Math.max(1, Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60000))} minutes</div></div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><b>Supervisor</b><div>{session.supervisor?.name || 'Assigned supervisor'} · {session.supervisor?.mode || 'OBSERVE'}</div></div><div><b>Billing</b><div>No charge · simulation only</div></div></div>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase text-slate-500">{human(session.status)}</span><button type="button" disabled={busy === session.appointmentId} onClick={() => void enter(session)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy === session.appointmentId ? 'Preparing room…' : 'Enter simulation'}</button></div>
        </article>
      )) : <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-600">You do not currently have a scheduled simulation session.</div>}
    </section>
  );
}
