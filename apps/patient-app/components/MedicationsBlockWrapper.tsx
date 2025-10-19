// apps/patient-app/components/MedicationsBlockWrapper.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Medication } from '@/types';
import ExportMedButton from './ExportMedButton';

type Medication = {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  started?: string;
  lastFilled?: string;
  status?: string;
  orderId?: string | null;
};

export default function MedicationsBlockWrapper({ initialMeds }: { initialMeds?: Medication[] }) {
  const [meds, setMeds] = useState<Medication[] | null>(initialMeds ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/medications', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // assume the endpoint returns an array
      setMeds(Array.isArray(data) ? data : (data.meds ?? data));
    } catch (err: any) {
      setError(err?.message || 'Could not load medications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialMeds) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpdateStatus(id: string, status: string) {
    try {
      const res = await fetch('/api/medications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      // update local UI
      setMeds(prev => (prev ? prev.map(m => (m.id === id ? { ...m, status } : m)) : prev));
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium">Current Medication</div>
        <div className="flex items-center gap-2">
          <ExportMedButton />
          <button onClick={load} className="px-2 py-1 text-xs border rounded bg-sky-50">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}

      {!loading && !error && (!meds || meds.length === 0) && (
        <div className="text-sm text-gray-600">No medications listed.</div>
      )}

      {!loading && meds && meds.length > 0 && (
        <ul className="text-sm space-y-2">
          {meds.map(m => (
            <li key={m.id} className="border rounded p-2 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{m.name} {m.dose ? `• ${m.dose}` : ''}</div>
                  <div className="text-xs text-gray-600">{m.frequency || ''} {m.route ? ` • ${m.route}` : ''}</div>
                  <div className="text-xs text-gray-400 mt-1">Started: {m.started ? new Date(m.started).toLocaleDateString() : '—'}</div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-xs">{m.status}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleUpdateStatus(m.id, 'Completed')}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(m.id, m.status === 'On Hold' ? 'Active' : 'On Hold')}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      Toggle Hold
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
