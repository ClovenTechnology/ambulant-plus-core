// apps/clinician-app/app/encounters/page.tsx
'use client';

import { useEffect, useState } from 'react';

const CLIN = (process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');

type Encounter = {
  id: string;
  caseId: string;
  patientId: string;
  clinicianId?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
};

type EncounterClaimsInfo = {
  count: number;
  hasVoucher: boolean;
};

type ClaimsApiResponse = {
  items?: any[];
};

function lower(v: any) {
  return v == null ? '' : String(v).toLowerCase();
}

function normalizeMethod(m?: string) {
  const s = lower(m);
  if (!s) return 'unknown';
  if (s === 'voucher-promo' || s.includes('voucher') || s.includes('promo')) {
    return 'voucher-promo';
  }
  if (s === 'medical-aid' || s.includes('medical')) {
    return 'medical-aid';
  }
  if (s === 'self-pay-card' || s.includes('card')) {
    return 'self-pay-card';
  }
  return 'unknown';
}

export default function Encounters() {
  const [rows, setRows] = useState<Encounter[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [claimsByEncounter, setClaimsByEncounter] = useState<
    Record<string, EncounterClaimsInfo>
  >({});

  const loadEncounters = async () => {
    try {
      const r = await fetch(`${CLIN}/api/encounters`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      setRows(Array.isArray(js) ? js : js.items ?? []);
    } catch (e: any) {
      setErr(`Failed to load encounters: ${e?.message || 'network error'}`);
      setRows([]);
    }
  };

  const loadClaimsSummary = async () => {
    try {
      const r = await fetch('/api/claims', { cache: 'no-store' });
      if (!r.ok) return;
      const js: ClaimsApiResponse = await r.json();
      const items = Array.isArray(js.items) ? js.items : [];
      const map: Record<string, EncounterClaimsInfo> = {};

      for (const c of items) {
        const encId = c?.encounterId;
        if (!encId) continue;
        const m = normalizeMethod(c?.payment?.method);
        if (!map[encId]) {
          map[encId] = { count: 0, hasVoucher: false };
        }
        map[encId].count += 1;
        if (m === 'voucher-promo') {
          map[encId].hasVoucher = true;
        }
      }

      setClaimsByEncounter(map);
    } catch {
      // silent failure; encounters page still works fine
    }
  };

  useEffect(() => {
    loadEncounters();
    loadClaimsSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setBusy('new');
    try {
      const r = await fetch(`${CLIN}/api/encounters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}), // server will synthesize defaults
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadEncounters();
    } catch (e: any) {
      setErr(`Failed to start encounter: ${e?.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  const close = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(
        `${CLIN}/api/encounters/${encodeURIComponent(id)}/close`,
        { method: 'PUT' },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadEncounters();
      // claims summary may change after closing (new auto-submit, etc.)
      await loadClaimsSummary();
    } catch (e: any) {
      setErr(`Failed to close ${id}: ${e?.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Encounters</h1>
          <p className="mt-1 text-xs text-gray-500">
            Start televisits, write eRx / labs and jump into claims &amp; funding
            for each encounter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Home
          </a>
          <a
            href="/dashboard"
            className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Dashboard
          </a>
          <a
            href="/claims"
            className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Claims
          </a>
          <button
            onClick={start}
            disabled={busy === 'new'}
            className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            + Start
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <table className="w-full rounded border bg-white text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Patient</th>
            <th className="p-2 text-left">Case</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Updated</th>
            <th className="p-2 text-left">Claims / Funding</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const info = claimsByEncounter[e.id];
            return (
              <tr key={e.id} className="border-t">
                <td className="p-2 font-mono">{e.id}</td>
                <td className="p-2">{e.patientId}</td>
                <td className="p-2">{e.caseId}</td>
                <td className="p-2">{e.status}</td>
                <td className="p-2">
                  {new Date(e.updatedAt).toLocaleString()}
                </td>
                <td className="p-2 text-xs">
                  {info ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-800">
                        {info.count} claim{info.count === 1 ? '' : 's'}
                      </span>
                      {info.hasVoucher && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                          Voucher ✅
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400">—</span>
                  )}
                </td>
                <td className="flex flex-wrap gap-1 p-2 text-xs">
                  <a
                    href={`/encounters/${encodeURIComponent(e.id)}`}
                    className="rounded border bg-white px-2 py-0.5 hover:bg-gray-50"
                  >
                    View
                  </a>
                  <a
                    href={`/orders/new?encounterId=${encodeURIComponent(e.id)}`}
                    className="rounded border bg-white px-2 py-0.5 hover:bg-gray-50"
                  >
                    Write eRx
                  </a>
                  <a
                    href={`/orders/new?encounterId=${encodeURIComponent(
                      e.id,
                    )}&tab=lab`}
                    className="rounded border bg-white px-2 py-0.5 hover:bg-gray-50"
                  >
                    Order Lab
                  </a>
                  <a
                    href={`/claims?encounterId=${encodeURIComponent(e.id)}`}
                    className="rounded border bg-white px-2 py-0.5 hover:bg-gray-50"
                  >
                    Claims
                  </a>
                  <button
                    onClick={() => close(e.id)}
                    disabled={busy === e.id}
                    className="rounded border bg-white px-2 py-0.5 disabled:opacity-50"
                  >
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-gray-500" colSpan={7}>
                No encounters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
