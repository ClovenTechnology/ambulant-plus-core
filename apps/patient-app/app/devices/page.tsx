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
  lastSeen?: string; // 👈 from gateway presence
};

export default function MyDevicesPage() {
  const [items, setItems] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      const r = await fetch(`${GATEWAY}/api/devices/list`, {
        cache: 'no-store',
        headers: {
          'x-uid': 'patient-local-001',
          'x-role': 'patient',
        }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000); // 👈 auto-refresh presence
    return () => clearInterval(id);
  }, []);

  async function unlink(deviceId: string) {
    if (!confirm('Unlink this device? This cannot be undone.')) return;
    setBusyId(deviceId);
    try {
      const r = await fetch(`${GATEWAY}/api/devices/unlink`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-uid': 'patient-local-001',
          'x-role': 'patient',
        },
        body: JSON.stringify({ device_id: deviceId })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to unlink');
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My Devices</h1>
        <a href="/devices/pair" className="px-3 py-1 border rounded bg-black text-white">Pair New Device</a>
      </header>

      {loading && <div className="p-3 border rounded bg-white">Loading…</div>}
      {err && <div className="p-3 border rounded bg-red-50 text-red-700 text-sm">Error: {err}</div>}

      {!loading && items.length === 0 && (
        <div className="p-3 border rounded bg-white text-sm text-gray-600">
          No devices found. Click <span className="font-medium">Pair New Device</span> to add one.
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
              {items.map(d => {
                const seen = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
                const ageSec = (now - seen) / 1000;
                const online = ageSec < 60;
                return (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{d.vendor || '—'}</td>
                    <td className="p-2">{d.category || '—'}</td>
                    <td className="p-2">{d.model || '—'}</td>
                    <td className="p-2 font-mono">{d.deviceId}</td>
                    <td className="p-2">{d.roomId || '—'}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {d.lastSeen && (
                        <div className="text-[10px] text-gray-400">
                          {new Date(d.lastSeen).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => unlink(d.deviceId)}
                        disabled={busyId === d.deviceId}
                        className="px-3 py-1 border rounded"
                      >
                        {busyId === d.deviceId ? 'Unlinking…' : 'Unlink'}
                      </button>
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
