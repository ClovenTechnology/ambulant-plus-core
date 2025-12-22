// apps/clinician-app/app/practice/cases/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type CaseRow = {
  encounterId: string;
  caseId: string;
  patientName: string;
  clinicianName: string;
  status: string;
  openedAt: string;
  lastUpdated: string;
  totalPaymentsCents: number;
  currency: string;
  claimCount: number;
};

type CasesResponse = {
  ok: boolean;
  demo?: boolean;
  items?: CaseRow[];
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
});

export default function PracticeCasesPage() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/practice/cases?limit=100`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
          },
        });
        const js: CasesResponse = await res.json().catch(() => ({ ok: false, error: 'Bad JSON' }));
        if (cancelled) return;

        if (!res.ok || js.ok === false) {
          throw new Error(js.error || `HTTP ${res.status}`);
        }

        setRows(js.items ?? []);
        setDemo(!!js.demo);
      } catch (e: any) {
        console.error('[practice/cases] load error', e);
        if (!cancelled) setErr(e?.message || 'Failed to load practice cases');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregates = useMemo(
    () => ({
      totalZar: rows.reduce(
        (sum, r) => (r.currency === 'ZAR' ? sum + r.totalPaymentsCents : sum),
        0,
      ),
      caseCount: rows.length,
    }),
    [rows],
  );

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-gray-900">
            Cases
          </h2>
          <p className="text-xs text-gray-600">
            Encounter-level view with payment totals per case.
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>
            Cases: <span className="font-semibold">{aggregates.caseCount}</span>
          </div>
          <div>
            Total captured (ZAR):{' '}
            <span className="font-semibold">
              {currencyFormatter.format(aggregates.totalZar / 100)}
            </span>
          </div>
          <div className="text-[11px] text-gray-400">
            Latest {rows.length} encounters
            {demo ? ' (demo data)' : ''}
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading cases…</div>}
      {err && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-gray-500 border border-dashed rounded p-4 bg-gray-50">
          No encounters found yet for your practice.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Case</th>
                <th className="px-3 py-2 text-left">Patient</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total Paid</th>
                <th className="px-3 py-2 text-left">Claims</th>
                <th className="px-3 py-2 text-left">Opened</th>
                <th className="px-3 py-2 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const opened = new Date(r.openedAt).toLocaleString();
                const updated = new Date(r.lastUpdated).toLocaleString();
                const totalLabel =
                  r.currency === 'ZAR'
                    ? currencyFormatter.format(r.totalPaymentsCents / 100)
                    : `${(r.totalPaymentsCents / 100).toFixed(2)} ${r.currency}`;

                return (
                  <tr key={r.encounterId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-gray-900 text-xs">
                        {r.caseId || r.encounterId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Encounter:{' '}
                        <span className="font-mono">{r.encounterId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs text-gray-900">{r.patientName}</div>
                      <div className="text-[11px] text-gray-500">{r.clinicianName}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
                          r.status === 'closed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'open'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-right text-xs font-semibold text-gray-900">
                      {totalLabel}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {r.claimCount}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-600">
                      {opened}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-600">
                      {updated}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
