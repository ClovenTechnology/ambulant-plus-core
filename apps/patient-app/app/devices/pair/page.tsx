'use client';

import { useEffect, useMemo, useState } from 'react';

type Catalog = {
  version: number;
  vendors: Array<{
    key: string; name: string;
    categories: Array<{
      key: string; name: string;
      models: Array<{
        key: string; name: string;
        capabilities: string[];
        ingest_key: string;
        pairing: { transport: string; notes: string[] };
      }>;
    }>;
  }>;
};

export default function PairDevicePage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [vendor, setVendor] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/devices/catalog', { cache: 'no-store' })
      .then(r => r.json())
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  const vendorObj = useMemo(
    () => catalog?.vendors.find(v => v.key === vendor),
    [catalog, vendor]
  );
  const categoryObj = useMemo(
    () => vendorObj?.categories.find(c => c.key === category),
    [vendorObj, category]
  );
  const modelObj = useMemo(
    () => categoryObj?.models.find(m => m.key === model),
    [categoryObj, model]
  );

  async function register() {
    setErr(null); setResult(null); setBusy(true);
    try {
      const body = { vendor, category, model, room_id: roomId || undefined };
      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // TEMP auth: until next-auth is wired, forward identity like the rest of the repo
          'x-uid': 'patient-local-001',
          'x-role': 'patient',
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setErr(e?.message || 'Failed to register device');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pair a Device</h1>
      </header>

      {!catalog && <div className="p-3 border rounded bg-white">Loading catalogâ€¦</div>}

      {catalog && (
        <>
          <section className="grid md:grid-cols-3 gap-3">
            <Selector label="Vendor" value={vendor} onChange={setVendor}
              options={catalog.vendors.map(v => ({ value: v.key, label: v.name }))} />
            <Selector label="Category" value={category} onChange={setCategory}
              options={(vendorObj?.categories || []).map(c => ({ value: c.key, label: c.name }))} disabled={!vendor} />
            <Selector label="Model" value={model} onChange={setModel}
              options={(categoryObj?.models || []).map(m => ({ value: m.key, label: m.name }))} disabled={!category} />
          </section>

          {modelObj && (
            <section className="border rounded bg-white p-4 space-y-3">
              <div className="font-medium">{modelObj.name}</div>
              <div className="text-sm text-gray-600">
                Capabilities: {modelObj.capabilities.join(', ')}
              </div>
              <div className="text-sm">
                <div className="font-medium mb-1">Pairing Notes</div>
                <ul className="list-disc pl-5 space-y-1">
                  {modelObj.pairing.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Link to room (optional):</label>
                <input
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="px-2 py-1 border rounded text-sm w-[220px]"
                  placeholder="e.g., consult-room"
                />
              </div>
              <div>
                <button
                  onClick={register}
                  disabled={busy}
                  className="px-3 py-1 border rounded bg-black text-white"
                >
                  {busy ? 'Registeringâ€¦' : 'Register Device'}
                </button>
              </div>
            </section>
          )}

          {err && <div className="p-3 border rounded bg-red-50 text-red-700 text-sm">Error: {err}</div>}

          {result?.ok && (
            <section className="border rounded bg-white p-4 space-y-3">
              <div className="font-medium">Device Registered</div>
              <KeyRow k="Device ID" v={result.device.device_id} />
              <KeyRow k="Secret" v={result.device.secret} />
              <KeyRow k="Vendor/Category/Model" v={`${result.device.vendor}/${result.device.category}/${result.device.model}`} />
              <KeyRow k="Patient" v={result.device.patient_id} />
              {result.device.room_id && <KeyRow k="Room" v={result.device.room_id} />}
              <div className="text-sm text-gray-600">
                Encode this as a QR for your mobile SDK:
              </div>
              <CodeBox json={result.qr_payload} />
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Selector({
  label, value, onChange, options, disabled
}: { label: string; value: string; onChange: (v: string) => void; options: Array<{value: string; label: string}>; disabled?: boolean }) {
  return (
    <label className="text-sm">
      <div className="text-gray-600 mb-1">{label}</div>
      <select
        value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1"
      >
        <option value="">{disabled ? 'â€”' : 'Selectâ€¦'}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-sm flex items-center justify-between">
      <div className="text-gray-500">{k}</div>
      <div className="font-mono">{v}</div>
    </div>
  );
}

function CodeBox({ json }: { json: any }) {
  const s = JSON.stringify(json, null, 2);
  return (
    <pre className="text-xs p-3 border rounded bg-slate-50 overflow-auto">{s}</pre>
  );
}
