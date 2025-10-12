'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { toast } from '../../components/ToastMount';
import { getLastRx } from '../../src/lib/orders-store';

type Phase = 'Idle' | 'Scheduled' | 'On the way' | 'Collected';

export default function MedReachPage() {
  const { activeEncounter } = useActiveEncounter();
  const encId = activeEncounter?.id ?? null;

  const [rx, setRx] = useState<{ drug: string; sig: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('Idle');
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      if (!encId) return;
      const last = await getLastRx(encId);
      if (!ok) return;
      setRx(last ? { drug: last.drug, sig: last.sig } : null);
      try {
        const raw = localStorage.getItem(`medreach.state.${encId}`);
        if (raw) {
          const s = JSON.parse(raw);
          setPhase(s.phase ?? 'Idle');
          setEta(s.eta ?? null);
        }
      } catch {}
    })();
    return () => {
      ok = false;
    };
  }, [encId]);

  useEffect(() => {
    if (!encId) return;
    try {
      localStorage.setItem(`medreach.state.${encId}`, JSON.stringify({ phase, eta }));
    } catch {}
  }, [phase, eta, encId]);

  const canSchedule = useMemo(() => Boolean(encId && rx), [encId, rx]);

  const schedule = () => {
    if (!canSchedule) return;
    const when = new Date(Date.now() + 30 * 60 * 1000);
    const s = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setEta(s);
    setPhase('Scheduled');
    toast('MedReach: collection scheduled', 'success');
    setTimeout(() => setPhase('On the way'), 2000);
    setTimeout(() => {
      setPhase('Collected');
      toast('MedReach: sample collected', 'success');
    }, 5000);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MedReach â€” Schedule Collection</h1>
        <div className="flex gap-2">
          <Link href="/medreach/timeline" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Track
          </Link>
          <Link href="/medreach/reorder" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Reorder
          </Link>
          <Link href="/medreach/reprint" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Reprint
          </Link>
          <Link href="/careport" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Go to CarePort
          </Link>
        </div>
      </header>

      {!encId ? (
        <div className="text-gray-500">Please choose an encounter first.</div>
      ) : (
        <section className="p-4 bg-white border rounded-lg space-y-3">
          <div className="text-sm text-gray-500">
            Encounter: <span className="font-medium">{encId}</span>
          </div>
          {!rx ? (
            <div className="text-gray-500">No eRx / order context yet for this encounter.</div>
          ) : (
            <>
              <div className="text-sm">
                <div>
                  <span className="font-medium">Prescription:</span> {rx.drug}
                </div>
                <div className="text-gray-600">{rx.sig}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={schedule}
                  disabled={phase === 'Collected'}
                  className="px-3 py-2 border rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {phase === 'Collected' ? 'Collected' : phase === 'On the way' ? 'Rider en routeâ€¦' : 'Schedule Collection'}
                </button>
                <span
                  className={`text-sm px-2 py-1 rounded-full border
                  ${
                    phase === 'Collected'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : phase === 'On the way'
                      ? 'bg-sky-50 border-sky-200 text-sky-700'
                      : phase === 'Scheduled'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  {phase}
                  {eta ? ` â€¢ ETA ${eta}` : ''}
                </span>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
