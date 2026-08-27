'use client';

import { useCallback, useEffect, useState } from 'react';
import PatientSimulationSessions from './PatientSimulationSessions';

type Invitation = {
  assignmentId: string;
  status: string;
  iomtRequested: boolean;
  recordingRequested: boolean;
  consent?: Record<string, boolean> | null;
  slot: null | {
    id: string;
    title: string;
    summary?: string | null;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    mode?: string;
    trainerName?: string | null;
    status?: string;
  };
};

function human(value: unknown) { const text = String(value || '').split('_').join(' '); return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Request failed'; }

export default function PatientTrainingInvitations() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [consents, setConsents] = useState<Record<string, { participation: boolean; audioVideo: boolean; iomt: boolean; recording: boolean }>>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [surface, setSurface] = useState<'training' | 'simulation'>('simulation');

  const load = useCallback(async () => {
    const response = await fetch('/api/training/invitations', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load training invitations');
    setItems(body?.invitations || []);
  }, []);

  useEffect(() => { void load().catch((error) => setNotice({ tone: 'err', text: human(error?.message) })); }, [load]);

  function consentFor(item: Invitation) {
    return consents[item.assignmentId] || {
      participation: Boolean(item.consent?.participationConsent),
      audioVideo: Boolean(item.consent?.audioVideoConsent),
      iomt: Boolean(item.consent?.iomtConsent),
      recording: Boolean(item.consent?.recordingAcknowledged),
    };
  }

  function updateConsent(item: Invitation, key: 'participation' | 'audioVideo' | 'iomt' | 'recording', value: boolean) {
    setConsents((current) => ({ ...current, [item.assignmentId]: { ...consentFor(item), [key]: value } }));
  }

  async function respond(item: Invitation, action: 'accept' | 'decline') {
    const consent = consentFor(item);
    setBusy(item.assignmentId); setNotice(null);
    try {
      const response = await fetch('/api/training/invitations', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assignmentId: item.assignmentId,
          action,
          participationConsent: consent.participation,
          audioVideoConsent: consent.audioVideo,
          iomtConsent: consent.iomt,
          recordingAcknowledged: consent.recording,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to update invitation');
      await load();
      setNotice({ tone: 'ok', text: action === 'accept' ? 'Invitation accepted. You can enter during the authorised joining window.' : 'Invitation declined.' });
    } catch (error: any) {
      setNotice({ tone: 'err', text: human(error?.message) });
    } finally { setBusy(''); }
  }

  async function enter(item: Invitation) {
    setBusy(item.assignmentId); setNotice(null);
    try {
      const response = await fetch('/api/training/admission', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignmentId: item.assignmentId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false || !body?.admission?.token) throw new Error(body?.error || 'Training admission unavailable');
      const admission = body.admission;
      const participantId = String(admission.uid || item.assignmentId || '').trim();
      if (!participantId) throw new Error('Patient participant identity unavailable');
      const query = new URLSearchParams({
        joinToken: admission.token,
        trainingSlotId: admission.trainingSlotId,
        participantId,
        uid: participantId,
        role: 'patient',
        participantRole: 'patient',
        startsAt: item.slot?.startsAt || '',
      });
      window.location.assign(`/training/room/${encodeURIComponent(admission.roomId)}?${query.toString()}`);
    } catch (error: any) {
      setNotice({ tone: 'err', text: human(error?.message) });
      setBusy('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-2xl border bg-white p-1 shadow-sm">
        <button type="button" onClick={() => setSurface('simulation')} className={`rounded-xl px-4 py-2 text-sm font-black ${surface === 'simulation' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>Simulation</button>
        <button type="button" onClick={() => setSurface('training')} className={`rounded-xl px-4 py-2 text-sm font-black ${surface === 'training' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>Training invitations</button>
      </div>
      {surface === 'simulation' ? (
        <PatientSimulationSessions />
      ) : (
    <section className="space-y-4">
      {notice ? <div className={`rounded-2xl border p-4 text-sm ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{notice.text}</div> : null}
      {items.length ? items.map((item) => {
        const consent = consentFor(item);
        const canAccept = consent.participation && consent.audioVideo && (!item.iomtRequested || consent.iomt) && (!item.recordingRequested || consent.recording);
        const active = item.status === 'accepted';
        return (
          <article key={item.assignmentId} className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><span className="rounded-full border px-2 py-1 text-[10px] font-black uppercase">{item.status}</span><h2 className="mt-3 text-xl font-black text-slate-950">{item.slot?.title || 'Training session'}</h2><p className="mt-1 text-sm text-slate-600">{item.slot?.summary || 'A supervised Ambulant+ training session.'}</p></div>
              <div className="text-sm text-slate-600 sm:text-right"><div className="font-bold text-slate-900">{item.slot?.startsAt ? new Date(item.slot.startsAt).toLocaleString() : 'Schedule pending'}</div><div>{item.slot?.timezone || 'Africa/Johannesburg'}</div>{item.slot?.trainerName ? <div>Trainer: {item.slot.trainerName}</div> : null}</div>
            </div>
            {item.status === 'invited' ? (
              <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
                <label className="flex gap-3 text-sm"><input type="checkbox" checked={consent.participation} onChange={(event) => updateConsent(item, 'participation', event.target.checked)} /><span>I consent to participate in this training session.</span></label>
                <label className="mt-3 flex gap-3 text-sm"><input type="checkbox" checked={consent.audioVideo} onChange={(event) => updateConsent(item, 'audioVideo', event.target.checked)} /><span>I consent to live audio and video communication with the training cohort.</span></label>
                {item.iomtRequested ? <label className="mt-3 flex gap-3 text-sm"><input type="checkbox" checked={consent.iomt} onChange={(event) => updateConsent(item, 'iomt', event.target.checked)} /><span>I consent to publish my selected IoMT readings to authorised room participants during this session.</span></label> : null}
                {item.recordingRequested ? <label className="mt-3 flex gap-3 text-sm"><input type="checkbox" checked={consent.recording} onChange={(event) => updateConsent(item, 'recording', event.target.checked)} /><span>I acknowledge that Admin plans to record this session under the published training policy.</span></label> : null}
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy === item.assignmentId || !canAccept} onClick={() => void respond(item, 'accept')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Accept invitation</button><button type="button" disabled={busy === item.assignmentId} onClick={() => void respond(item, 'decline')} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">Decline</button></div>
              </div>
            ) : null}
            {active ? <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black text-emerald-950">Consent recorded</div><div className="text-sm text-emerald-800">A fresh signed admission will be issued when you enter.</div></div><button type="button" disabled={busy === item.assignmentId} onClick={() => void enter(item)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy === item.assignmentId ? 'Preparing room...' : 'Enter training room'}</button></div> : null}
          </article>
        );
      }) : <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-600">You do not currently have a training invitation.</div>}
    </section>
      )}
    </div>
  );
}
