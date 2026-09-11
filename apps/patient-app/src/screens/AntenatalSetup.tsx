'use client';

import React, { useEffect, useState } from 'react';
import { Save, Bell, Globe } from 'lucide-react';
import {
  hydrateAntenatalState,
  loadAntenatalPrefs,
  saveAntenatalPrefs,
  calcEDD,
  type AntenatalPrefs,
} from '@/src/analytics/antenatal';
import { isPushSupported, registerServiceWorker, subscribePush } from '@/src/analytics/push';

export function AntenatalSetup() {
  const [lmp, setLmp] = useState('');
  const [cycleDays, setCycleDays] = useState<number>(28);
  const [edd, setEdd] = useState('');
  const [address, setAddress] = useState('');
  const [geoLat, setGeoLat] = useState('');
  const [geoLon, setGeoLon] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await hydrateAntenatalState();
        if (!alive) return;
        const existing = loadAntenatalPrefs();
        setLmp(existing?.lmp ?? '');
        setCycleDays(existing?.cycleDays ?? 28);
        setEdd(existing?.edd ?? (existing?.lmp ? calcEDD(existing.lmp, existing.cycleDays ?? 28) : ''));
        setAddress(existing?.address ?? '');
        setGeoLat(existing?.geo?.lat != null ? String(existing.geo.lat) : '');
        setGeoLon(existing?.geo?.lon != null ? String(existing.geo.lon) : '');
      } catch (error: any) {
        if (alive) setNote(error?.message || 'Could not load antenatal preferences.');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (lmp) setEdd(calcEDD(lmp, cycleDays));
  }, [lmp, cycleDays]);

  async function handleSave() {
    const prefs: AntenatalPrefs = {
      lmp: lmp || undefined,
      cycleDays: cycleDays || undefined,
      edd: edd || undefined,
      address: address || undefined,
      geo: geoLat && geoLon ? { lat: Number(geoLat), lon: Number(geoLon) } : undefined,
    };
    try {
      setNote('Saving…');
      await saveAntenatalPrefs(prefs);
      setNote('Antenatal preferences saved securely.');
    } catch (error: any) {
      setNote(error?.message || 'Could not save antenatal preferences.');
    }
  }

  async function handleEnablePush() {
    if (!isPushSupported()) {
      alert('Push API / Service Worker not supported in this browser.');
      return;
    }
    const reg = await registerServiceWorker();
    if (!reg) return alert('Service worker registration failed.');
    const sub = await subscribePush(reg);
    if (sub) alert('Push subscription saved.');
    else alert('Push subscription failed or VAPID key missing.');
  }

  async function handleSendTestPush() {
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json();
      if (json?.ok) alert('Test push sent (or queued).');
      else alert('Test push failed: ' + (json?.error ?? res.statusText));
    } catch (e) {
      console.error(e);
      alert('Test push request failed.');
    }
  }

  return (
    <div className="p-2 space-y-3">
      <h3 className="text-lg font-semibold">Antenatal Setup</h3>
      <label className="block">
        <span className="text-sm">Last Menstrual Period (LMP)</span>
        <input type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} className="border p-2 rounded w-full" />
      </label>
      <label className="block">
        <span className="text-sm">Cycle Length (days)</span>
        <input type="number" min={20} max={40} value={cycleDays} onChange={(e) => setCycleDays(Number(e.target.value))} className="border p-2 rounded w-full" />
      </label>
      <label className="block">
        <span className="text-sm">Estimated Delivery Date (EDD)</span>
        <input type="date" value={edd} onChange={(e) => setEdd(e.target.value)} className="border p-2 rounded w-full" />
        <div className="text-xs text-gray-500 mt-1">Calculated from LMP and cycle length; verify with your maternity clinician.</div>
      </label>
      <div className="grid md:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm">Clinic address (optional)</span>
          <textarea value={address} onChange={(e)=>setAddress(e.target.value)} rows={3} className="border p-2 rounded w-full" />
        </label>
        <div>
          <label className="block"><span className="text-sm">Clinic latitude</span><input value={geoLat} onChange={(e)=>setGeoLat(e.target.value)} className="border p-2 rounded w-full" /></label>
          <label className="block mt-2"><span className="text-sm">Clinic longitude</span><input value={geoLon} onChange={(e)=>setGeoLon(e.target.value)} className="border p-2 rounded w-full" /></label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white inline-flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
        <button onClick={handleEnablePush} className="px-3 py-2 rounded border inline-flex items-center gap-2"><Bell className="w-4 h-4" /> Enable Push</button>
        <button onClick={handleSendTestPush} className="px-3 py-2 rounded border inline-flex items-center gap-2"><Globe className="w-4 h-4" /> Send test push</button>
      </div>
      {note ? <div className="text-xs text-gray-600">{note}</div> : null}
    </div>
  );
}
