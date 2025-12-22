// apps/clinician-app/app/practice/claims/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type ClaimRow = {
  id: string;
  encounterId: string;
  caseId: string;
  patientName: string;
  clinicianName: string;
  status: string;
  amountCents: number;
  currency: string;
  fundingSource?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

type ClaimsResponse = {
  ok: boolean;
  demo?: boolean;
  items?: ClaimRow[];
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
});

export default function PracticeClaimsPage() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/practice/claims?limit=100`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
            // x-uid is optional — real auth will wire this
          },
        });
        const js: ClaimsResponse = await res.json().catch(() => ({ ok: false, error: 'Bad JSON' }));
        if (cancelled) return;

        if (!res.ok || js.ok === false) {
          throw new Error(js.error || `HTTP ${res.status}`);
        }

        setRows(js.items ?? []);
        setDemo(!!js.demo);
      } catch (e: any) {
        console.error('[practice/claims] load error', e);
        if (!cancelled) {
          setErr(e?.message || 'Failed to load practice claims');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalZar = useMemo(
    () =>
      rows.reduce((sum, r) => (r.currency === 'ZAR' ? sum + r.amountCents : sum), 0),
    [rows],
  );

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-gray-900">
            Claims
          </h2>
          <p className="text-xs text-gray-600">
            Payments generated from completed encounters, grouped at claim level.
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>
            Total (ZAR captured):{' '}
            <span className="font-semibold">
              {currencyFormatter.format(totalZar / 100)}
            </span>
          </div>
          <div className="text-[11px] text-gray-400">
            Showing latest {rows.length} claim lines
            {demo ? ' (demo data)' : ''}
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading claims…</div>}
      {err && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-gray-500 border border-dashed rounded p-4 bg-gray-50">
          No claims found yet. Claims will appear once encounters generate payments.
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
                <th className="px-3 py-2 text-left">Funding</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const created = new Date(r.createdAt).toLocaleString();
                const paid = r.paidAt ? new Date(r.paidAt).toLocaleString() : '—';
                const amountLabel =
                  r.currency === 'ZAR'
                    ? currencyFormatter.format(r.amountCents / 100)
                    : `${(r.amountCents / 100).toFixed(2)} ${r.currency}`;
                const funding = r.fundingSource || 'unknown';

                return (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-gray-900 text-xs">
                        {r.caseId || r.encounterId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Encounter: <span className="font-mono">{r.encounterId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs text-gray-900">{r.patientName}</div>
                      <div className="text-[11px] text-gray-500">{r.clinicianName}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
                          r.status === 'captured'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {funding}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-xs font-semibold text-gray-900">
                      {amountLabel}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-600">
                      {created}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-600">
                      {paid}
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
