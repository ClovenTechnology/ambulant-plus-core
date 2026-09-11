'use client';

import React, { useEffect, useState } from 'react';

type FertilityPrefs = {
  lmp: string;
  cycleDays: number;
};

let cachedPrefs: FertilityPrefs | null = null;

export function FertilitySetup() {
  const [lmp, setLmp] = useState('');
  const [cycleDays, setCycleDays] = useState(28);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch('/api/wellness/fertility', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!alive || !res.ok || !data?.ok) return;
      const prefs: FertilityPrefs = {
        lmp: String(data?.prefs?.lmp || ''),
        cycleDays: Math.max(20, Math.min(40, Number(data?.prefs?.cycleDays || 28))),
      };
      cachedPrefs = prefs;
      setLmp(prefs.lmp);
      setCycleDays(prefs.cycleDays);
    })();
    return () => { alive = false; };
  }, []);

  const save = async () => {
    try {
      setBusy(true);
      setNote(null);
      const res = await fetch('/api/wellness/fertility', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lmp, cycleDays }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'fertility_preferences_save_failed');
      cachedPrefs = { lmp, cycleDays };
      setNote('Cycle tracking preferences saved securely.');
    } catch (error: any) {
      setNote(error?.message || 'Could not save cycle tracking preferences.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Cycle Tracking Setup</h2>
      <p className="text-sm text-slate-600">
        Record your last menstrual period and usual cycle length. This screen does not diagnose ovulation or pregnancy.
      </p>
      <label className="block">
        <span className="text-sm">Last Menstrual Period (LMP)</span>
        <input type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} className="border p-2 rounded w-full" />
      </label>
      <label className="block">
        <span className="text-sm">Cycle Length (days)</span>
        <input type="number" value={cycleDays} onChange={(e) => setCycleDays(Number(e.target.value))} className="border p-2 rounded w-full" min={20} max={40} />
      </label>
      <button onClick={() => void save()} disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60">
        {busy ? 'Saving…' : 'Save'}
      </button>
      {note ? <p className="text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}

export function loadUserFertilityPrefs(): FertilityPrefs | null {
  return cachedPrefs;
}
