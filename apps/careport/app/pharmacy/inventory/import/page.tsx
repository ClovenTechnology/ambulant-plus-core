//apps/careport/app/pharmacy/inventory/import/page.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function parsePreview(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];
  const headers = parseCsvLine(rows[0]).map((h) => h.toLowerCase().trim());
  return rows.slice(1, 11).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

const sample = `drugCode,name,price,currency,isGeneric,isActive\nNAPP12345,Amlodipine 5mg tablets,89.99,ZAR,false,true\nNAPP54321,Amlodipine generic 5mg tablets,54.99,ZAR,true,true`;

export default function PharmacyInventoryImportPage() {
  const [csv, setCsv] = useState(sample);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => parsePreview(csv), [csv]);

  async function submit() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/careport/pharmacies/me/inventory/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `import_http_${res.status}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Bulk import</p>
          <h1 className="text-2xl font-semibold text-slate-950">Upload pharmacy inventory</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Paste CSV inventory. Required columns are name and price. Recommended columns: drugCode, name, price, currency, isGeneric, isActive.
          </p>
        </div>
        <Link href="/pharmacy/inventory" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
          Back to inventory
        </Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Imported {result.created ?? result.valid ?? 0} SKU records.{' '}
          {Array.isArray(result.errors) && result.errors.length ? `${result.errors.length} rows had issues.` : 'No row issues reported.'}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-950">CSV content</label>
          <textarea
            className="mt-3 h-[420px] w-full rounded-2xl border p-3 font-mono text-xs"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setCsv(sample)}>
              Reset sample
            </button>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={busy || !csv.trim()}
              onClick={() => void submit()}
            >
              {busy ? 'Importing...' : 'Import inventory'}
            </button>
          </div>
        </div>

        <aside className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Preview</h2>
          <p className="mt-1 text-xs text-slate-500">Showing up to 10 rows before import.</p>
          <div className="mt-4 space-y-2">
            {preview.map((row, idx) => (
              <div key={idx} className="rounded-2xl border p-3 text-xs">
                <div className="font-medium text-slate-900">{row.name || row.medication || 'Unnamed medicine'}</div>
                <div className="mt-1 text-slate-500">Code: {row.drugcode || row.drug_code || '—'}</div>
                <div className="text-slate-500">Price: {row.price || row.pricecents || '—'} {row.currency || ''}</div>
                <div className="text-slate-500">Type: {String(row.isgeneric || row.is_generic || '').toLowerCase() === 'true' ? 'Generic' : 'Original'}</div>
              </div>
            ))}
            {!preview.length && <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">No preview rows yet.</div>}
          </div>
        </aside>
      </section>
    </main>
  );
}
