'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { toast } from '../../components/ToastMount';
import { getLastRx } from '../../src/lib/orders-store';

type Status = 'Idle' | 'Preparing' | 'Out for delivery' | 'Delivered';

export default function CarePortPage() {
  const { activeEncounter } = useActiveEncounter();
  const encId = activeEncounter?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [rx, setRx] = useState<{ drug: string; sig: string } | null>(null);
  const [status, setStatus] = useState<Status>('Idle');

  useEffect(() => {
    let ok = true;
    (async () => {
      if (!encId) return;
      const last = await getLastRx(encId);
      if (!ok) return;
      setRx(last ? { drug: last.drug, sig: last.sig } : null);
      try {
        const raw = localStorage.getItem(`careport.status.${encId}`);
        if (raw) setStatus(JSON.parse(raw));
      } catch {}
    })();
    return () => {
      ok = false;
    };
  }, [encId]);

  useEffect(() => {
    if (!encId) return;
    try {
      localStorage.setItem(`careport.status.${encId}`, JSON.stringify(status));
    } catch {}
  }, [status, encId]);

  const canDispatch = useMemo(() => Boolean(encId && rx), [encId, rx]);

  const dispatch = async () => {
    if (!canDispatch) return;
    toast('CarePort: dispatch requested', 'info');
    setLoading(true);
    setStatus('Preparing');
    setTimeout(() => setStatus('Out for delivery'), 1500);
    setTimeout(() => {
      setStatus('Delivered');
      toast('CarePort: order delivered', 'success');
      setLoading(false);
    }, 4500);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CarePort Dispatch</h1>
        <div className="flex gap-2">
          <Link href="/careport/timeline" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Track
          </Link>
          <Link href="/careport/reorder" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Reorder
          </Link>
          <Link href="/careport/reprint" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Reprint
          </Link>
          <Link href="/orders" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
            Back to Orders
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
            <div className="text-gray-500">No eRx found yet for this encounter.</div>
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
                  onClick={dispatch}
                  disabled={loading || status === 'Delivered'}
                  className="px-3 py-2 border rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {status === 'Delivered' ? 'Delivered' : loading ? 'Dispatching...' : 'Dispatch via CarePort'}
                </button>
                <span
                  className={`text-sm px-2 py-1 rounded-full border
                  ${
                    status === 'Delivered'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : status === 'Out for delivery'
                      ? 'bg-sky-50 border-sky-200 text-sky-700'
                      : status === 'Preparing'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  {status}
                </span>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
