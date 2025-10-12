// apps/patient-app/src/screens/AntenatalSetup.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Save, Bell, Globe, Check, X } from 'lucide-react';
import {
  loadAntenatalPrefs,
  saveAntenatalPrefs,
  calcEDD,
  type AntenatalPrefs,
} from '@/src/analytics/antenatal';
import { isPushSupported, registerServiceWorker, subscribePush } from '@/src/analytics/push';

export function AntenatalSetup() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const existing = useMemo(() => (mounted ? loadAntenatalPrefs() : null), [mounted]);

  const [lmp, setLmp] = useState(existing?.lmp ?? '');
  const [cycleDays, setCycleDays] = useState<number>(existing?.cycleDays ?? 28);
  const [edd, setEdd] = useState(existing?.edd ?? (existing?.lmp ? calcEDD(existing.lmp, existing.cycleDays ?? 28) : ''));
  const [address, setAddress] = useState(existing?.address ?? '');
  const [geoLat, setGeoLat] = useState(existing?.geo?.lat ? String(existing.geo.lat) : '');
  const [geoLon, setGeoLon] = useState(existing?.geo?.lon ? String(existing.geo.lon) : '');

  useEffect(() => {
    if (!mounted) return;
    if (lmp) setEdd(calcEDD(lmp, cycleDays));
  }, [lmp, cycleDays, mounted]);

  async function handleSave() {
    const prefs: AntenatalPrefs = {
      lmp: lmp || undefined,
      cycleDays: cycleDays || undefined,
      edd: edd || undefined,
      address: address || undefined,
      geo: geoLat && geoLon ? { lat: Number(geoLat), lon: Number(geoLon) } : undefined,
    } as any;
    saveAntenatalPrefs(prefs);
    alert('Antenatal preferences saved ✅');
  }

  async function handleEnablePush() {
    if (!isPushSupported()) {
      alert('Push API / Service Worker not supported in this browser.');
      return;
    }
    const reg = await registerServiceWorker();
    if (!reg) return alert('Service worker registration failed.');
    const sub = await subscribePush(reg);
    if (sub) alert('Push subscription saved (dev).');
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
        <input type="date" value={edd ?? ''} onChange={(e) => setEdd(e.target.value)} className="border p-2 rounded w-full" />
        <div className="text-xs text-gray-500 mt-1">Auto-calculated from LMP & cycle length; editable.</div>
      </label>

      <div className="grid md:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm">Clinic address (optional)</span>
          <textarea value={address} onChange={(e)=>setAddress(e.target.value)} rows={3} className="border p-2 rounded w-full" placeholder="Clinic name\nStreet address\nCity, Country" />
        </label>

        <div>
          <label className="block">
            <span className="text-sm">Clinic latitude</span>
            <input value={geoLat} onChange={(e)=>setGeoLat(e.target.value)} className="border p-2 rounded w-full" placeholder="-26.2041" />
          </label>
          <label className="block mt-2">
            <span className="text-sm">Clinic longitude</span>
            <input value={geoLon} onChange={(e)=>setGeoLon(e.target.value)} className="border p-2 rounded w-full" placeholder="28.0473" />
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white inline-flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>

        <button onClick={handleEnablePush} className="px-3 py-2 rounded border inline-flex items-center gap-2">
          <Bell className="w-4 h-4" /> Enable Push
        </button>

        <button onClick={handleSendTestPush} className="px-3 py-2 rounded border inline-flex items-center gap-2">
          <Globe className="w-4 h-4" /> Send test push
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Push uses your browser’s push API and a dev in-memory endpoint. In production replace the server endpoint with a persistent store & push sender.
      </div>
    </div>
  );
}
