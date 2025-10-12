// apps/patient-app/components/AllergiesPanel.tsx
'use client';

import { useEffect, useState } from 'react';

type Allergy = {
  id?: string;
  substance?: string;
  reaction?: string;
  severity?: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt?: string;
};

export default function AllergiesPanel({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const d: Allergy[] = await r.json();
      setRows(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load allergies');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const active = rows.filter(r => r.status === 'Active');

  const exportSoap = async () => {
    setOk(null); setErr(null);
    try {
      const payload = {
        section: 'Allergies',
        items: active.map(a => ({
          id: a.id || '',
          substance: a.substance || '',
          reaction: a.reaction || '',
          severity: a.severity || '',
          status: a.status,
          notedAt: a.notedAt || '',
        })),
      };
      const r = await fetch('/api/soap/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setOk('Exported to clinician SOAP.');
    } catch (e: any) {
      setErr(e?.message || 'Export failed');
    }
  };

  return (
    <section className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="text-sm font-semibold">
          Allergies {active.length > 0 && <span className="ml-1 text-xs text-amber-600">({active.length} active)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50" disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={exportSoap} className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50" disabled={!active.length}>
            Export to SOAP
          </button>
          <button onClick={() => setOpen(v => !v)} className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50">
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-3">
          {err && <div className="mb-2 rounded border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-xs">{err}</div>}
          {ok  && <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-xs">{ok}</div>}

          <div className="space-y-2 text-sm">
            {rows.length === 0 && <div className="text-gray-500">No allergies recorded.</div>}
            {rows.map((a, i) => (
              <div key={i} className="border rounded p-2 bg-white">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.substance || 'Unknown'}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${a.status === 'Active' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                    {a.status}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {a.reaction ? `Reaction: ${a.reaction}` : 'Reaction: —'} · {a.severity || '—'}
                </div>
                {a.notedAt && <div className="text-[11px] text-gray-500 mt-0.5">Noted: {new Date(a.notedAt).toLocaleString()}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
