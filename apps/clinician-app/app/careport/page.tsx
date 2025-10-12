'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EncounterHandoffBanner from '../../components/EncounterHandoffBanner';

type EncounterPayload = {
  encounterId?: string; // e.g. GUID or composite
  caseId?: string;      // longitudinal (episode/case)
  sessionId?: string;   // one consult/visit
  roomId?: string;
  patient?: { id?: string; name?: string };
  clinician?: { id?: string; name?: string };
  notes?: any;
  eRx?: { drug?: string; sig?: string } | null;
  ts?: string;
};

type Status = 'Idle' | 'Preparing' | 'Out for delivery' | 'Delivered';

export default function CarePortPage() {
  // read ?enc= and resolve payload from sessionStorage (non-breaking; no backend assumption)
  const encKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('enc');
  }, []);

  const [enc, setEnc] = useState<EncounterPayload | null>(null);
  const [status, setStatus] = useState<Status>('Idle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!encKey || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(encKey);
      if (!raw) return;
      const payload = JSON.parse(raw) as EncounterPayload;
      setEnc(payload);

      // restore persisted status if any
      const sid = payload.sessionId || payload.encounterId || 'default';
      const saved = localStorage.getItem(`clin.careport.status.${sid}`);
      if (saved) setStatus(JSON.parse(saved));
    } catch {}
  }, [encKey]);

  useEffect(() => {
    if (!enc) return;
    const sid = enc.sessionId || enc.encounterId || 'default';
    try {
      localStorage.setItem(`clin.careport.status.${sid}`, JSON.stringify(status));
    } catch {}
  }, [status, enc]);

  const canDispatch = Boolean(enc?.eRx?.drug);

  const dispatch = async () => {
    if (!canDispatch) return;
    setLoading(true);
    setStatus('Preparing');
    // simple client-only progression to keep this non-breaking
    setTimeout(() => setStatus('Out for delivery'), 1400);
    setTimeout(() => { setStatus('Delivered'); setLoading(false); }, 4200);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <EncounterHandoffBanner />

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CarePort — Dispatch</h1>
        <div className="flex gap-2">
          <Link href="/orders" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">Orders</Link>
          <Link href="/medreach" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">MedReach</Link>
        </div>
      </header>

      {!enc ? (
        <div className="text-gray-500">No encounter loaded. Launch from Televisit/SFU with “Send to eRx/CarePort”.</div>
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
            <div className="text-sm font-medium">Prescription</div>
            {!enc.eRx?.drug ? (
              <div className="text-sm text-gray-500 mt-1">No eRx found on this encounter yet.</div>
            ) : (
              <div className="text-sm mt-1">
                <div><span className="font-medium">Drug:</span> {enc.eRx.drug}</div>
                <div className="text-gray-600">{enc.eRx.sig}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={dispatch}
              disabled={!canDispatch || loading || status === 'Delivered'}
              className="px-3 py-2 border rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {status === 'Delivered' ? 'Delivered' : loading ? 'Dispatching…' : 'Dispatch via CarePort'}
            </button>
            <span className={`text-sm px-2 py-1 rounded-full border
              ${status === 'Delivered' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
               : status === 'Out for delivery' ? 'bg-sky-50 border-sky-200 text-sky-700'
               : status === 'Preparing' ? 'bg-amber-50 border-amber-200 text-amber-700'
               : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {status}
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
