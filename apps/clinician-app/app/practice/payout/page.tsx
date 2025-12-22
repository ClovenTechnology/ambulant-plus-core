// apps/clinician-app/app/practice/payout/page.tsx
'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type MemberSplitRow = {
  clinicianId: string;
  clinicianName: string;
  virtualSharePctToPractice: number;
  inPersonSharePctToPractice: number;
  facilityFeeFixedZarPerInPersonVisit?: number | null;
  last30dNetToPracticeCents?: number | null;
};

type PracticePayoutSummary = {
  ok: boolean;
  currency: string;
  practiceName: string;
  practiceBankLast4?: string | null;
  lastPayoutAmountCents?: number | null;
  lastPayoutAt?: string | null;
  nextPayoutAmountCents?: number | null;
  nextPayoutAt?: string | null;
  last30dGrossCents: number;
  last30dNetToPracticeCents: number;
  last30dNetToCliniciansCents: number;
  memberSplits: MemberSplitRow[];
};

function fallbackPayoutSummary(): PracticePayoutSummary {
  return {
    ok: true,
    currency: 'ZAR',
    practiceName: 'Demo Multi-Clinic Practice',
    practiceBankLast4: '1234',
    lastPayoutAmountCents: 180_000_00,
    lastPayoutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    nextPayoutAmountCents: 210_000_00,
    nextPayoutAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    last30dGrossCents: 480_000_00,
    last30dNetToPracticeCents: 210_000_00,
    last30dNetToCliniciansCents: 270_000_00,
    memberSplits: [
      {
        clinicianId: 'clin-1',
        clinicianName: 'Dr A. Demo',
        virtualSharePctToPractice: 0.2,
        inPersonSharePctToPractice: 0.3,
        facilityFeeFixedZarPerInPersonVisit: 150,
        last30dNetToPracticeCents: 80_000_00,
      },
      {
        clinicianId: 'clin-2',
        clinicianName: 'Dr B. Demo',
        virtualSharePctToPractice: 0.15,
        inPersonSharePctToPractice: 0.25,
        facilityFeeFixedZarPerInPersonVisit: 120,
        last30dNetToPracticeCents: 60_000_00,
      },
      {
        clinicianId: 'clin-3',
        clinicianName: 'Dr C. Demo',
        virtualSharePctToPractice: 0.18,
        inPersonSharePctToPractice: 0.3,
        facilityFeeFixedZarPerInPersonVisit: 140,
        last30dNetToPracticeCents: 70_000_00,
      },
    ],
  };
}

function cents(cents: number | null | undefined, currency: string) {
  const v = typeof cents === 'number' ? cents : 0;
  const num = v / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(num);
}

export default function PracticePayoutPage() {
  const [summary, setSummary] = useState<PracticePayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/practice/payouts/summary`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
            'x-scope': 'practice',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as PracticePayoutSummary | null;
        if (cancelled) return;
        setSummary(js ?? fallbackPayoutSummary());
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[practice/payout] demo fallback', e?.message);
        setErr('Using demo data; practice payout API not wired yet.');
        setSummary(fallbackPayoutSummary());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) {
    return <main className="p-4">Loading…</main>;
  }

  const cur = summary.currency || 'ZAR';

  const gross = summary.last30dGrossCents;
  const toPractice = summary.last30dNetToPracticeCents;
  const toClinicians = summary.last30dNetToCliniciansCents;
  const practiceSharePct = gross ? (toPractice / gross) * 100 : 0;
  const clinicianSharePct = gross ? (toClinicians / gross) * 100 : 0;

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Practice payouts
          </h1>
          <p className="text-sm text-gray-500">
            Aggregated revenue and payout flow from platform → practice →
            clinicians.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {summary.practiceName}
            {summary.practiceBankLast4 && (
              <>
                {' '}
                · Bank account ending in{' '}
                <span className="font-mono">
                  {summary.practiceBankLast4}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
          {loading && <span>Refreshing…</span>}
          {err && (
            <span className="max-w-xs text-right text-amber-700">
              {err}
            </span>
          )}
        </div>
      </header>

      {/* High-level summary cards */}
      <section className="grid gap-4 md:grid-cols-4 text-sm">
        <KpiCard
          label="Gross consult revenue (30d)"
          value={cents(gross, cur)}
        />
        <KpiCard
          label="Net to practice (30d)"
          value={cents(toPractice, cur)}
          hint={`${practiceSharePct.toFixed(1)}% of gross`}
        />
        <KpiCard
          label="Net to clinicians (30d)"
          value={cents(toClinicians, cur)}
          hint={`${clinicianSharePct.toFixed(1)}% of gross`}
        />
        <KpiCard
          label="Next payout (est.)"
          value={cents(summary.nextPayoutAmountCents, cur)}
          hint={
            summary.nextPayoutAt
              ? new Date(summary.nextPayoutAt).toLocaleDateString()
              : undefined
          }
        />
      </section>

      {/* Flow explanation */}
      <section className="rounded-lg border bg-white p-4 text-xs text-gray-700 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Flow: Platform → Practice → Clinicians
        </h2>
        <ol className="list-decimal pl-4 space-y-1">
          <li>
            A consult is billed; platform applies{' '}
            <strong>plan payoutSharePct</strong> (see individual clinician
            payout page).
          </li>
          <li>
            From the clinician portion, the{' '}
            <strong>practice share</strong> is calculated using{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">
              PracticeClinicianSplit
            </code>{' '}
            (virtual vs in-person + facility fee).
          </li>
          <li>
            The resulting amounts are batched into:
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              <li>Practice aggregate payout (this page).</li>
              <li>Per-clinician payouts (on the clinician&apos;s own page).</li>
            </ul>
          </li>
        </ol>
        <p className="pt-1 text-[11px] text-gray-500">
          Back-end wiring lives in practice-scoped payout jobs and APIs like{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">
            /practice/payouts/summary
          </code>{' '}
          and{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">
            /practice/payouts/members
          </code>
          .
        </p>
      </section>

      {/* Per-member split table */}
      <section className="rounded-lg border bg-white p-4 text-xs">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Member splits & contributions (last 30 days)
          </h2>
          <span className="text-[11px] text-gray-500">
            {summary.memberSplits.length} members
          </span>
        </div>

        {summary.memberSplits.length === 0 ? (
          <div className="text-gray-500">
            No member payout data yet. Once consults run through practice,
            this table will populate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-[11px]">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Clinician</Th>
                  <Th>Virtual share to practice</Th>
                  <Th>In-person share to practice</Th>
                  <Th>Facility fee</Th>
                  <Th>Net to practice (30d)</Th>
                </tr>
              </thead>
              <tbody>
                {summary.memberSplits.map((m) => (
                  <tr key={m.clinicianId} className="border-t">
                    <Td>
                      <div className="font-medium text-gray-800">
                        {m.clinicianName}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {m.clinicianId}
                      </div>
                    </Td>
                    <Td>
                      {(m.virtualSharePctToPractice * 100).toFixed(1)}%
                    </Td>
                    <Td>
                      {(m.inPersonSharePctToPractice * 100).toFixed(1)}%
                    </Td>
                    <Td>
                      {m.facilityFeeFixedZarPerInPersonVisit != null
                        ? `R ${m.facilityFeeFixedZarPerInPersonVisit.toFixed(0)}`
                        : '—'}
                    </Td>
                    <Td>
                      {cents(
                        m.last30dNetToPracticeCents ?? 0,
                        cur,
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-1 text-left text-[11px] font-semibold text-gray-600">
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-2 py-1 align-top ${className}`}>{children}</td>
  );
}
