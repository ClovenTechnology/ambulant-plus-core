'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EncounterHandoffBanner from '../../components/EncounterHandoffBanner';

type EncounterPayload = {
  encounterId?: string;
  caseId?: string;
  sessionId?: string;
  roomId?: string;
  patient?: { id?: string; name?: string };
  clinician?: { id?: string; name?: string };
  notes?: any;
  eRx?: { drug?: string; sig?: string } | null;
  ts?: string;
};

type Phase = 'Idle' | 'Scheduled' | 'On the way' | 'Collected';

export default function MedReachPage() {
  const encKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('enc');
  }, []);

  const [enc, setEnc] = useState<EncounterPayload | null>(null);
  const [phase, setPhase] = useState<Phase>('Idle');
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    if (!encKey || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(encKey);
      if (!raw) return;
      const payload = JSON.parse(raw) as EncounterPayload;
      setEnc(payload);

      const sid = payload.sessionId || payload.encounterId || 'default';
      const saved = localStorage.getItem(`clin.medreach.state.${sid}`);
      if (saved) {
        const s = JSON.parse(saved);
        setPhase(s.phase ?? 'Idle');
        setEta(s.eta ?? null);
      }
    } catch {}
  }, [encKey]);

  useEffect(() => {
    if (!enc) return;
    const sid = enc.sessionId || enc.encounterId || 'default';
    try {
      localStorage.setItem(`clin.medreach.state.${sid}`, JSON.stringify({ phase, eta }));
    } catch {}
  }, [phase, eta, enc]);

  const canSchedule = Boolean(enc?.eRx?.drug);

  const schedule = () => {
    if (!canSchedule) return;
    const when = new Date(Date.now() + 30 * 60 * 1000);
    const s = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setEta(s);
    setPhase('Scheduled');

    // non-breaking client progression
    setTimeout(() => setPhase('On the way'), 1800);
    setTimeout(() => setPhase('Collected'), 4800);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <EncounterHandoffBanner />

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MedReach — Lab Collection</h1>
        <div className="flex gap-2">
          <Link href="/orders" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">Orders</Link>
          <Link href="/careport" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">CarePort</Link>
        </div>
      </header>

      {!enc ? (
        <div className="text-gray-500">No encounter loaded. Launch from Televisit/SFU with “Send to Lab/MedReach”.</div>
      ) : (
        <section className="p-4 bg-white border rounded-lg space-y-4">
          <div className="text-sm text-gray-600 grid gap-1">
            <div><span className="font-medium">Patient:</span> {enc.patient?.name || '—'}</div>
            <div><span className="font-medium">Clinician:</span> {enc.clinician?.name || '—'}</div>
            <div className="text-xs">
              <span className="font-medium">IDs:</span>{' '}
              {enc.encounterId ? `encounter=${enc.encounterId} · ` : ''}
              {enc.caseId ? `case=${enc.caseId} · ` : ''}
              {enc.sessionId ? `session=${enc.sessionId}` : ''}
            </div>
          </div>

          <div className="rounded border p-3 bg-gray-50">
            <div className="text-sm font-medium">Order context</div>
            {!enc.eRx?.drug ? (
              <div className="text-sm text-gray-500 mt-1">No eRx / order context yet for this encounter.</div>
            ) : (
              <div className="text-sm mt-1">
                <div><span className="font-medium">Prescription:</span> {enc.eRx.drug}</div>
                <div className="text-gray-600">{enc.eRx.sig}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={schedule}
              disabled={!canSchedule || phase === 'Collected'}
              className="px-3 py-2 border rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {phase === 'Collected' ? 'Collected' : phase === 'On the way' ? 'Rider en route…' : 'Schedule Collection'}
            </button>
            <span className={`text-sm px-2 py-1 rounded-full border
              ${phase === 'Collected' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
               : phase === 'On the way' ? 'bg-sky-50 border-sky-200 text-sky-700'
               : phase === 'Scheduled' ? 'bg-amber-50 border-amber-200 text-amber-700'
               : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {phase}{eta ? ` • ETA ${eta}` : ''}
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
