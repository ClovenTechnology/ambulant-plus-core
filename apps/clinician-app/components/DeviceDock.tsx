'use client';

import { useEffect, useMemo, useState } from 'react';
import useVitalsSSE from './useVitalsSSE';
import Sparkline from './Sparkline';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type DeviceRow = {
  id: string;
  deviceId: string;
  roomId: string | null;
  vendor: string | null;
  category: string | null;
  model: string | null;
  lastSeenAt?: string; // some APIs
  lastSeen?: string;   // others (e.g., /api/devices/list from gateway sample)
};

const CARDS: Array<{ key: string; label: string; unit?: string; color: string }> = [
  { key: 'bp_sys', label: 'SYS',   unit: 'mmHg', color: '#ef4444' },
  { key: 'bp_dia', label: 'DIA',   unit: 'mmHg', color: '#f97316' },
  { key: 'hr',     label: 'HR',    unit: 'bpm',  color: '#22c55e' },
  { key: 'spo2',   label: 'SpO₂',  unit: '%',    color: '#06b6d4' },
  { key: 'temp',   label: 'Temp',  unit: '°C',   color: '#6366f1' },
  { key: 'rr',     label: 'RR',    unit: '/min', color: '#a855f7' },
  { key: 'hrv',    label: 'HRV',   unit: 'ms',   color: '#14b8a6' },
  { key: 'steps',  label: 'Steps', unit: '',     color: '#84cc16' },
];

export default function DeviceDock({
  patientId, roomId, clinicianId = 'clinician-local-001',
}: { patientId?: string|null; roomId?: string|null; clinicianId?: string }) {

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔗 Vitals SSE buffer (guard for undefined to avoid runtime errors)
  const { buffer } = useVitalsSSE(roomId || '', 120) as { buffer?: Array<{ type: string; ts: number; value: number }> };
  const safeBuf = Array.isArray(buffer) ? buffer : [];

  // device fetch
  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('patient_id', patientId);
    fetch(`${GATEWAY}/api/devices/list?${qs}`, {
      cache: 'no-store',
      headers: { 'x-uid': clinicianId, 'x-role': 'clinician' },
    })
      .then((r) => r.json())
      // Accept both { items: [...] } and { devices: [...] } shapes
      .then((d) => setDevices(d.items || d.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, [patientId, clinicianId]);

  const attached = useMemo(
    () => devices.filter((d) => d.roomId === roomId),
    [devices, roomId]
  );

  function presenceBadge(d: DeviceRow) {
    const seen = d.lastSeenAt || d.lastSeen;
    if (!seen) return <span className="text-gray-400 text-[11px]">⚪ Idle</span>;
    const online = Date.now() - new Date(seen).getTime() <= 60_000;
    return (
      <span className="text-[11px] font-medium">
        {online ? '🟢 Online' : '⚪ Idle'} · {new Date(seen).toLocaleTimeString()}
      </span>
    );
  }

  return (
    <section className="border rounded bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">Device Dock</div>
        <div className="text-xs text-gray-500">
          {loading ? 'Loading…' : `${attached.length}/${devices.length} attached`}
        </div>
      </div>

      {/* Attached devices */}
      <div className="p-2 space-y-2">
        {attached.length === 0 && (
          <div className="text-sm text-gray-600 p-2">
            No devices attached to this room.
          </div>
        )}
        {attached.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between border rounded px-2 py-1 bg-gray-50 text-sm"
          >
            <div>
              {d.vendor || '—'} {d.model || ''}{' '}
              <span className="text-xs text-gray-500">({d.deviceId})</span>
            </div>
            {presenceBadge(d)}
          </div>
        ))}
      </div>

      {/* Vital sparklines from shared buffer */}
      <div className="p-2 grid sm:grid-cols-2 gap-2">
        {CARDS.map((card) => {
          const arr = safeBuf
            .filter((v) => v?.type === card.key)
            .map((v) => ({ t: v.ts, y: v.value }));
          const latest = arr.at(-1);
          return (
            <div key={card.key} className="border rounded p-2">
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase text-gray-500">{card.label}</div>
                <div className="text-sm font-semibold">
                  {latest ? `${latest.y}${card.unit ? ` ${card.unit}` : ''}` : '—'}
                </div>
              </div>
              <Sparkline data={arr} color={card.color} height={56} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
