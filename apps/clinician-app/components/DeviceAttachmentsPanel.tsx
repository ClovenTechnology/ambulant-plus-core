'use client';

import { useEffect, useState, useCallback } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type DeviceRow = {
  id: string;
  deviceId: string;
  roomId: string | null;
  vendor: string | null;
  category: string | null;
  model: string | null;
  lastSeenAt?: string;
};

export default function DeviceAttachmentsPanel({
  patientId, roomId, clinicianId = 'clinician-local-001',
}: { patientId?: string|null; roomId?: string|null; clinicianId?: string }) {
  const [devices,setDevices] = useState<DeviceRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState<string|null>(null);
  const [lastUpdated,setLastUpdated] = useState<Date|null>(null);

  const refresh = useCallback(async()=>{
    if(!roomId) return;
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams(); qs.set('room_id', roomId);
      if(patientId) qs.set('patient_id', patientId);
      const r = await fetch(`${GATEWAY}/api/devices/list?${qs}`,{
        cache:'no-store',
        headers:{'x-uid':clinicianId,'x-role':'clinician'}
      });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDevices(j.items||[]);
      setLastUpdated(new Date());
    } catch(e:any) {
      setErr(e?.message||'Failed to load devices');
    } finally { setLoading(false); }
  },[roomId,patientId,clinicianId]);

  useEffect(()=>{ refresh(); const t=setInterval(refresh,30_000); return()=>clearInterval(t); },[refresh]);

  function presenceBadge(d: DeviceRow) {
    if (!d.lastSeenAt) return '⚪ Idle';
    const online = Date.now() - new Date(d.lastSeenAt).getTime() <= 60_000;
    return online ? '🟢 Online' : '⚪ Idle';
  }

  return (
    <section className="border rounded bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">Attached Devices</div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            {loading ? 'Loading…' : `${devices.length} found`}
            {lastUpdated && !loading && (
              <span className="ml-2 text-[10px] text-gray-400">updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <button onClick={refresh} disabled={loading} className="px-2 py-0.5 border rounded text-xs hover:bg-gray-100">Refresh</button>
        </div>
      </div>

      <div className="divide-y">
        {err && <div className="p-2 text-sm text-red-600">Error loading devices: {err}</div>}
        {!loading && devices.length===0 && <div className="p-2 text-sm text-gray-500">No devices attached to this room.</div>}
        {devices.map(d=>(
          <div key={d.id} className="flex items-center justify-between p-2 text-sm">
            <div>
              <div className="font-medium">{d.vendor || '—'} {d.model || ''}</div>
              <div className="text-xs text-gray-500 font-mono">{d.deviceId}</div>
            </div>
            <div>{presenceBadge(d)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
