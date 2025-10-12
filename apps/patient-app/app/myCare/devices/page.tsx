'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

type Device = {
  id: string;
  kind: 'wearable' | 'stethoscope' | 'otoscope' | 'monitor' | 'ring' | 'scale' | string;
  vendor: string;
  model: string;
  displayName?: string;
  paired?: boolean;
  lastSeenAt?: string | null;
  status?: 'disconnected' | 'connected' | 'streaming';
};

type ListResp = { devices: Device[] } | Device[];

const BASE = process.env.NEXT_PUBLIC_BASE_URL || '';

export default function DevicesPage() {
  const [loading, setLoading] = useState(false);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/devices/list', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: ListResp = await r.json();
      setDevices(Array.isArray(j) ? j : j.devices || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeName = (d: Device) =>
    d.displayName || `${d.vendor} ${d.model}` || d.id;

  const statusChip = (d: Device) => {
    const s = d.status || (d.paired ? 'connected' : 'disconnected');
    const cls =
      s === 'streaming'
        ? 'bg-emerald-600 text-white'
        : s === 'connected'
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-200 text-gray-700';
    return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{s}</span>;
  };

  const kindLabel = (k: Device['kind']) =>
    ({
      wearable: 'Wearable',
      stethoscope: 'Stethoscope',
      otoscope: 'Otoscope',
      monitor: 'Health Monitor',
      ring: 'Ring',
      scale: 'Smart Scale',
    }[k] || k);

  const sorted = useMemo(
    () =>
      [...devices].sort((a, b) => safeName(a).localeCompare(safeName(b))),
    [devices]
  );

  const onPair = async (id: string) => {
    setPairingId(id);
    setErr(null);
    try {
      const r = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: id }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(t || `HTTP ${r.status}`);
      }
      await load();
      alert('Pairing started (check system Bluetooth prompt if applicable).');
    } catch (e: any) {
      alert(`Pair failed: ${e?.message || e}`);
    } finally {
      setPairingId(null);
    }
  };

  const onStream = async (id: string) => {
    setStreamingId(id);
    setErr(null);
    try {
      const r = await fetch('/api/devices/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: id }),
      });
      const j = await r.json().catch(() => ({}));
      // Expecting { consoleUrl: string } from the API.
      const url: string =
        j?.consoleUrl || `/myCare/devices/console?deviceId=${encodeURIComponent(id)}`;
      window.location.href = url;
    } catch (e: any) {
      alert(`Stream start failed: ${e?.message || e}`);
    } finally {
      setStreamingId(null);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">My Devices</h1>
          <p className="text-sm text-gray-600">
            Pair your wearables and IoMT devices. Start a test stream in the console.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {err && (
        <div className="rounded border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Device</th>
              <th className="text-left p-2">Kind</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Last Seen</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{safeName(d)}</div>
                  <div className="text-xs text-gray-500">{d.id}</div>
                </td>
                <td className="p-2">{kindLabel(d.kind)}</td>
                <td className="p-2">{statusChip(d)}</td>
                <td className="p-2">
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onPair(d.id)}
                      disabled={pairingId === d.id}
                      className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      title="Pair / bind over BLE"
                    >
                      {pairingId === d.id ? 'Pairing…' : 'Pair'}
                    </button>
                    <button
                      onClick={() => onStream(d.id)}
                      disabled={streamingId === d.id}
                      className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      title="Open streaming console"
                    >
                      {streamingId === d.id ? 'Starting…' : 'Stream'}
                    </button>
                    <Link
                      className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
                      href={`/myCare/devices/console?deviceId=${encodeURIComponent(d.id)}`}
                      title="Open test console"
                    >
                      Console
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={5}>
                  No devices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Console opens a device-specific panel (stethoscope audio, otoscope video/photo,
        health monitor vitals, ring PPG/ECG spot checks).
      </div>
    </main>
  );
}
