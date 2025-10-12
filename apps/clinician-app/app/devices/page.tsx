'use client';

import { useEffect, useState } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type DeviceRow = {
  id: string;
  deviceId: string;
  patientId: string | null;
  roomId: string | null;
  vendor: string | null;
  category: string | null;
  model: string | null;
  createdAt: string;
  lastSeenAt?: string; // new for status badge
};

export default function ClinicianDevicesPage() {
  const [items, setItems] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [roomId, setRoomId] = useState('consult-room');
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${GATEWAY}/api/devices/list`, {
        cache: 'no-store',
        headers: {
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function attach(deviceId: string) {
    if (!roomId) return alert('Enter a room to attach.');
    setBusy(deviceId);
    try {
      const r = await fetch(`${GATEWAY}/api/devices/attach`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
        body: JSON.stringify({ device_id: deviceId, room_id: roomId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Attach failed');
    } finally {
      setBusy(null);
    }
  }

  async function detach(deviceId: string) {
    setBusy(deviceId);
    try {
      const r = await fetch(`${GATEWAY}/api/devices/detach`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Detach failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My Devices (Clinician)</h1>
        <a href="/devices/tester" className="px-3 py-1 border rounded">
          Open Tester
        </a>
      </header>

      <section className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Attach to room:</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="px-2 py-1 border rounded text-sm"
        />
        <a
          href="/televisit?page=attach"
          className="text-sm underline ml-2"
        >
          Go to Televisit
        </a>
      </section>

      {loading && <div className="p-3 border rounded bg-white">Loading…</div>}
      {err && (
        <div className="p-3 border rounded bg-red-50 text-red-700 text-sm">
          Error: {err}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="p-3 border rounded bg-white text-sm">
          No devices yet.
        </div>
      )}

      {items.length > 0 && (
        <section className="border rounded bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-2">Vendor</th>
                <th className="p-2">Category</th>
                <th className="p-2">Model</th>
                <th className="p-2">Device ID</th>
                <th className="p-2">Room</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const online =
                  d.lastSeenAt &&
                  Date.now() - new Date(d.lastSeenAt).getTime() <= 60_000;
                return (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{d.vendor || '—'}</td>
                    <td className="p-2">{d.category || '—'}</td>
                    <td className="p-2">{d.model || '—'}</td>
                    <td className="p-2 font-mono">{d.deviceId}</td>
                    <td className="p-2">{d.roomId || '—'}</td>
                    <td className="p-2">
                      {online ? '🟢 Online' : '⚪ Idle'}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => attach(d.deviceId)}
                          disabled={busy === d.deviceId}
                          className="px-2 py-1 border rounded"
                        >
                          {busy === d.deviceId ? 'Attaching…' : 'Attach'}
                        </button>
                        {d.roomId && (
                          <button
                            onClick={() => detach(d.deviceId)}
                            disabled={busy === d.deviceId}
                            className="px-2 py-1 border rounded"
                          >
                            {busy === d.deviceId ? 'Detaching…' : 'Detach'}
                          </button>
                        )}
                        <a
                          className="px-2 py-1 border rounded"
                          href={`/devices/${encodeURIComponent(d.deviceId)}`}
                        >
                          Details
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
