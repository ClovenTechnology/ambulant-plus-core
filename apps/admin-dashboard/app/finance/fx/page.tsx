// apps/admin-dashboard/app/finance/fx/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type FxLatestResp = {
  ok: boolean;
  base: string;
  asOf?: string;
  rates: Record<
    string,
    { rate: number; asOf?: string; source?: 'manual' | 'auto'; derived?: boolean }
  >;
  error?: string;
};

type AuditResp = {
  ok: boolean;
  base: string;
  items: Array<{
    id: string;
    createdAt: string;
    actorEmail?: string | null;
    actorUserId?: string | null;
    action: string;
    note?: string | null;
    requestId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    changes: any;
  }>;
  error?: string;
};

type Row = {
  quote: string;
  current?: number | null;
  currentAsOf?: string | null;
  currentSource?: string | null;
  next?: string; // editable string
};

const DEFAULT_QUOTES = [
  'ZAR',
  'USD',
  'NGN',
  'KES',
  'GHS',
  'BWP',
  'ZMW',
  'TZS',
  'UGX',
  'RWF',
  'ETB',
  'GBP',
  'EUR',
  'AED',
  'SAR',
  'CAD',
  'AUD',
  'BRL',
  'ARS',
  'NZD',
  'INR',
];

function isIso(s: string) {
  return /^[A-Z]{3}$/.test(s);
}

function money(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function pctChange(before?: number | null, after?: number | null) {
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (!Number.isFinite(a) || a <= 0) return null;
  return (a - b) / b;
}

export default function FxAdminPage() {
  const [base] = useState('USD'); // canonical base for manual input
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 16)); // local datetime input
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<AuditResp | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);

  async function loadLatest() {
    setErr(null);
    try {
      const res = await fetch(`/api/fx/latest?base=${encodeURIComponent(base)}`, { cache: 'no-store' });
      const js = (await res.json().catch(() => ({}))) as FxLatestResp;
      if (!res.ok || !js.ok) throw new Error(js?.error || `Failed to load FX (${res.status})`);

      const available = Object.keys(js.rates || {}).filter(isIso);
      const merged = Array.from(new Set([...DEFAULT_QUOTES, ...available]))
        .filter((c) => c !== base)
        .sort((a, b) => a.localeCompare(b));

      const nextRows: Row[] = merged.map((quote) => {
        const r = js.rates?.[quote];
        return {
          quote,
          current: typeof r?.rate === 'number' ? r.rate : null,
          currentAsOf: r?.asOf || null,
          currentSource: r?.source || null,
          next: typeof r?.rate === 'number' ? String(r.rate) : '',
        };
      });

      setRows(nextRows);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load FX');
      setRows(DEFAULT_QUOTES.filter((c) => c !== base).map((quote) => ({ quote, next: '' })));
    }
  }

  async function loadAudit() {
    setAuditBusy(true);
    try {
      const res = await fetch(`/api/fx/audit?base=${encodeURIComponent(base)}&limit=50`, { cache: 'no-store' });
      const js = (await res.json().catch(() => ({}))) as AuditResp;
      if (!res.ok || !js.ok) throw new Error(js?.error || `Audit failed (${res.status})`);
      setAudit(js);
    } catch (e: any) {
      setAudit({ ok: false, base, items: [], error: e?.message || 'Audit failed' });
    } finally {
      setAuditBusy(false);
    }
  }

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    if (!qq) return rows;
    return rows.filter((r) => r.quote.includes(qq));
  }, [rows, q]);

  const changes = useMemo(() => {
    const out: Array<{ quote: string; before: number | null; after: number; change: number | null }> = [];
    for (const r of rows) {
      const after = Number(r.next);
      if (!Number.isFinite(after) || after <= 0) continue;
      const before = typeof r.current === 'number' ? r.current : null;
      const ch = pctChange(before, after);
      out.push({ quote: r.quote, before, after, change: ch });
    }
    return out;
  }, [rows]);

  const bigMoves = useMemo(() => {
    return changes.filter((c) => c.change != null && Math.abs(c.change) > 0.1);
  }, [changes]);

  const canSave = useMemo(() => {
    if (!changes.length) return false;
    if (bigMoves.length && !note.trim()) return false;
    return true;
  }, [changes.length, bigMoves.length, note]);

  function setNext(quote: string, next: string) {
    setRows((prev) =>
      prev.map((r) => (r.quote === quote ? { ...r, next } : r)),
    );
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const rates: Record<string, number> = {};
      for (const r of rows) {
        const v = Number(r.next);
        if (!Number.isFinite(v) || v <= 0) continue;
        rates[r.quote] = v;
      }

      if (!Object.keys(rates).length) throw new Error('No valid rates to save.');

      // Convert datetime-local to ISO
      const dt = new Date(asOf);
      const asOfIso = isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();

      const res = await fetch('/api/fx/manual', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          base,
          asOf: asOfIso,
          note: note.trim() || undefined,
          rates,
        }),
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok || js.ok === false) throw new Error(js?.error || `Save failed (${res.status})`);

      setNote('');
      await loadLatest();
      if (auditOpen) await loadAudit();
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">FX Rates</h1>
          <p className="text-sm text-gray-600">
            Enter the value of <span className="font-mono">1 {base}</span> in each currency (example: 1 USD = 19.28 ZAR).
            Manual rates are authoritative and are fully audited.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            onClick={async () => {
              setAuditOpen((v) => !v);
              if (!auditOpen) await loadAudit();
            }}
          >
            {auditOpen ? 'Hide audit' : 'View audit'}
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            onClick={loadLatest}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </header>

      {err ? (
        <div className="text-sm text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">{err}</div>
      ) : null}

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter currency code (e.g., ZAR)…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">As of</label>
            <input
              type="datetime-local"
              className="border rounded-lg px-2 py-2 text-sm"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-600">
            Note (required when any change &gt; 10%)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for update (e.g., Finance daily rates / provider discrepancy fix)…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          {bigMoves.length ? (
            <div className="text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
              Big move detected (&gt;10%) for: {bigMoves.map((x) => x.quote).join(', ')}. A note is required.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium text-sm">Rates (base: {base})</div>
          <div className="text-xs text-gray-500">{filtered.length} currencies</div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-xs text-gray-500 border-b bg-gray-50">
              <tr>
                <th className="text-left py-2 px-4">Currency</th>
                <th className="text-left py-2 px-4">Current</th>
                <th className="text-left py-2 px-4">As of</th>
                <th className="text-left py-2 px-4">Source</th>
                <th className="text-left py-2 px-4">New rate</th>
                <th className="text-left py-2 px-4">% Δ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const after = Number(r.next);
                const change = pctChange(r.current ?? null, Number.isFinite(after) ? after : null);
                const isBig = change != null && Math.abs(change) > 0.1;

                return (
                  <tr key={r.quote} className="border-b last:border-b-0">
                    <td className="py-2 px-4 font-mono text-xs">{r.quote}</td>
                    <td className="py-2 px-4">{typeof r.current === 'number' ? money(r.current) : '—'}</td>
                    <td className="py-2 px-4 text-xs text-gray-600">
                      {r.currentAsOf ? new Date(r.currentAsOf).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-4 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-gray-50">
                        {r.currentSource || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <input
                        className={[
                          'border rounded px-2 py-1 text-sm w-40 outline-none',
                          isBig ? 'border-amber-400' : '',
                        ].join(' ')}
                        value={r.next || ''}
                        onChange={(e) => setNext(r.quote, e.target.value)}
                        placeholder="e.g. 19.28"
                        inputMode="decimal"
                      />
                    </td>
                    <td className="py-2 px-4 text-xs">
                      {change == null ? (
                        '—'
                      ) : (
                        <span className={isBig ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                          {(change * 100).toFixed(2)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filtered.length ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-sm text-gray-500">
                    No currencies match your filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !canSave}
          className="px-4 py-2 rounded bg-black text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving…' : 'Save manual rates'}
        </button>
        <div className="text-[11px] text-gray-500">
          Tip: leave a currency blank to keep it unchanged.
        </div>
      </div>

      {auditOpen ? (
        <section className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-medium text-sm">Audit trail</div>
            <div className="text-xs text-gray-500">{auditBusy ? 'Loading…' : 'Latest 50'}</div>
          </div>

          <div className="p-4 space-y-3">
            {audit?.error ? (
              <div className="text-sm text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">
                {audit.error}
              </div>
            ) : null}

            {(audit?.items || []).map((a) => (
              <div key={a.id} className="border rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {a.action} <span className="text-xs text-gray-500">• {new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-600">{a.actorEmail || a.actorUserId || 'Unknown actor'}</div>
                </div>

                {a.note ? <div className="text-xs text-gray-700 mt-1">Note: {a.note}</div> : null}

                <details className="mt-2">
                  <summary className="text-xs text-blue-600 cursor-pointer">View changes</summary>
                  <pre className="mt-2 text-[11px] bg-gray-50 border rounded p-2 overflow-auto">
{JSON.stringify(a.changes, null, 2)}
                  </pre>
                </details>
              </div>
            ))}

            {!auditBusy && !(audit?.items || []).length ? (
              <div className="text-sm text-gray-500">No audit entries yet.</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
