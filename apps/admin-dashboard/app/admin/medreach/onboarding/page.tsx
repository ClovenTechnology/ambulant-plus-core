// apps/admin-dashboard/app/admin/medreach/onboarding/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lab = {
  id: string;
  name: string;
  contact?: string | null;
  active?: boolean;
  status?: string | null;
  onboardingStatus?: string | null;
  country?: string | null;
  currency?: string | null;
  canManageStaff?: boolean;
  canPublishResults?: boolean;
  payoutAccountMasked?: string | null;
  ownerUserId?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  counts?: {
    offeredTests?: number;
    panels?: number;
    staffMembers?: number;
    eligibleOrders?: number;
  };
};

type Phleb = {
  id: string;
  userId?: string;
  active?: boolean;
  approvalStatus?: string | null;
  country?: string | null;
  currency?: string | null;
  payoutAccountMasked?: string | null;
  defaultLabId?: string | null;
  defaultLab?: {
    id?: string;
    name?: string;
    active?: boolean;
    status?: string;
  } | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  completedJobsCount?: number;
  cancelledJobsCount?: number;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

type Evidence = {
  id: string;
  kind?: string;
  subjectId?: string | null;
  subjectType?: string | null;
  documentType?: string | null;
  status?: string | null;
  decision?: string | null;
  sourceEvidenceId?: string | null;
  at?: string | null;
};

type EvidenceStats = {
  total: number;
  submitted: number;
  accepted: number;
  rejected: number;
  needsMoreInfo: number;
  pending: number;
};

type Filter = 'all' | 'pending' | 'active' | 'rejected' | 'blocked';

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asLabs(raw: any): Lab[] {
  const data = raw?.data || raw?.labs || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

function asPhlebs(raw: any): Phleb[] {
  const data = raw?.data || raw?.phlebs || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

function asEvidence(raw: any): Evidence[] {
  const data = raw?.data || raw?.evidence || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

function evidenceStatus(row: Evidence) {
  return String(row.status || row.decision || '').toUpperCase();
}

function evidenceSummary(rows: Evidence[]): EvidenceStats {
  const submittedRows = rows.filter(
    (row) => row.kind === 'medreach_onboarding_evidence_submitted',
  );

  const reviewedSourceIds = new Set(
    rows
      .filter((row) => row.sourceEvidenceId)
      .map((row) => String(row.sourceEvidenceId)),
  );

  const accepted = rows.filter((row) => evidenceStatus(row) === 'ACCEPTED').length;
  const rejected = rows.filter((row) => evidenceStatus(row) === 'REJECTED').length;
  const needsMoreInfo = rows.filter(
    (row) => evidenceStatus(row) === 'NEEDS_MORE_INFO',
  ).length;
  const pending = submittedRows.filter((row) => !reviewedSourceIds.has(row.id)).length;

  return {
    total: rows.length,
    submitted: submittedRows.length,
    accepted,
    rejected,
    needsMoreInfo,
    pending,
  };
}
function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
}

function labStatus(lab: Lab) {
  return String(lab.status || (lab.active === false ? 'PENDING' : 'ACTIVE')).toUpperCase();
}

function phlebStatus(phleb: Phleb) {
  return String(phleb.approvalStatus || (phleb.active === false ? 'PENDING' : 'ACTIVE')).toUpperCase();
}

function isRejected(status?: string | null) {
  return String(status || '').toUpperCase() === 'REJECTED';
}

function isActive(status?: string | null, active?: boolean) {
  const s = String(status || '').toUpperCase();
  return active !== false && (s === 'ACTIVE' || s === 'APPROVED');
}

function labReadiness(lab: Lab) {
  const approved = isActive(lab.status, lab.active);
  const staff = n(lab.counts?.staffMembers) > 0;
  const tests = n(lab.counts?.offeredTests) > 0;
  const panels = n(lab.counts?.panels) > 0;
  const payout = Boolean(lab.payoutAccountMasked);
  const results = lab.canPublishResults !== false;

  return {
    approved,
    staff,
    tests,
    panels,
    payout,
    results,
    score: [approved, staff, tests, panels, payout, results].filter(Boolean).length,
  };
}

function phlebReadiness(phleb: Phleb) {
  const approved = isActive(phleb.approvalStatus, phleb.active);
  const active = phleb.active !== false;
  const defaultLab = Boolean(phleb.defaultLabId || phleb.defaultLab?.id);
  const payout = Boolean(phleb.payoutAccountMasked);
  const performance =
    n(phleb.completedJobsCount) > 0 || n(phleb.ratingCount) > 0;

  return {
    approved,
    active,
    defaultLab,
    payout,
    performance,
    score: [approved, active, defaultLab, payout, performance].filter(Boolean).length,
  };
}

function tone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (s === 'ACTIVE' || s === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (s === 'REJECTED') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function readinessTone(ok: boolean) {
  return ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function Pill({ text, ok }: { text: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${readinessTone(ok)}`}
    >
      {text}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-gray-500">{hint}</div> : null}
    </div>
  );
}

export default function MedReachOnboardingPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [phlebs, setPhlebs] = useState<Phleb[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [q, setQ] = useState('');
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const [labsRes, phlebsRes, evidenceRes] = await Promise.all([
        fetch('/api/admin/medreach/labs?limit=300', { cache: 'no-store' }),
        fetch('/api/admin/medreach/phlebs?limit=300', { cache: 'no-store' }),
        fetch('/api/admin/medreach/evidence?limit=500', { cache: 'no-store' }),
      ]);

      const labsJson = await labsRes.json().catch(() => null);
      const phlebsJson = await phlebsRes.json().catch(() => null);
      const evidenceJson = await evidenceRes.json().catch(() => null);

      if (!labsRes.ok || labsJson?.ok === false) {
        throw new Error(labsJson?.error || `Labs HTTP ${labsRes.status}`);
      }

      if (!phlebsRes.ok || phlebsJson?.ok === false) {
        throw new Error(phlebsJson?.error || `Phlebs HTTP ${phlebsRes.status}`);
      }

      if (!evidenceRes.ok || evidenceJson?.ok === false) {
        throw new Error(evidenceJson?.error || `Evidence HTTP ${evidenceRes.status}`);
      }
      setLabs(asLabs(labsJson));
      setPhlebs(asPhlebs(phlebsJson));
      setEvidence(asEvidence(evidenceJson));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load MedReach onboarding control centre');
      setLabs([]);
      setPhlebs([]);
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const pendingLabs = labs.filter((lab) => labStatus(lab) === 'PENDING').length;
    const activeLabs = labs.filter((lab) => isActive(lab.status, lab.active)).length;
    const rejectedLabs = labs.filter((lab) => isRejected(lab.status)).length;

    const pendingPhlebs = phlebs.filter((phleb) => phlebStatus(phleb) === 'PENDING').length;
    const activePhlebs = phlebs.filter((phleb) =>
      isActive(phleb.approvalStatus, phleb.active),
    ).length;
    const rejectedPhlebs = phlebs.filter((phleb) =>
      isRejected(phleb.approvalStatus),
    ).length;

    return {
      totalLabs: labs.length,
      activeLabs,
      pendingLabs,
      rejectedLabs,
      totalPhlebs: phlebs.length,
      activePhlebs,
      pendingPhlebs,
      rejectedPhlebs,
      blocked:
        labs.filter((lab) => labReadiness(lab).score < 4).length +
        phlebs.filter((phleb) => phlebReadiness(phleb).score < 3).length,
    };
  }, [labs, phlebs]);

  const evidenceBySubject = useMemo(() => {
    const map = new Map<string, Evidence[]>();

    for (const row of evidence) {
      const subjectType = String(row.subjectType || '').toLowerCase();
      const subjectId = String(row.subjectId || '').trim();

      if (!subjectType || !subjectId) continue;

      const key = `${subjectType}:${subjectId}`;
      const list = map.get(key) || [];

      list.push(row);
      map.set(key, list);
    }

    return map;
  }, [evidence]);
  const filteredLabs = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return labs.filter((lab) => {
      const status = labStatus(lab);
      const readiness = labReadiness(lab);

      if (filter === 'pending' && status !== 'PENDING') return false;
      if (filter === 'active' && !isActive(lab.status, lab.active)) return false;
      if (filter === 'rejected' && !isRejected(lab.status)) return false;
      if (filter === 'blocked' && readiness.score >= 4) return false;

      if (!needle) return true;

      return [lab.id, lab.name, lab.contact, lab.ownerUserId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [labs, filter, q]);

  const filteredPhlebs = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return phlebs.filter((phleb) => {
      const status = phlebStatus(phleb);
      const readiness = phlebReadiness(phleb);

      if (filter === 'pending' && status !== 'PENDING') return false;
      if (filter === 'active' && !isActive(phleb.approvalStatus, phleb.active)) return false;
      if (filter === 'rejected' && !isRejected(phleb.approvalStatus)) return false;
      if (filter === 'blocked' && readiness.score >= 3) return false;

      if (!needle) return true;

      return [phleb.id, phleb.userId, phleb.defaultLabId, phleb.defaultLab?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [phlebs, filter, q]);

  async function patchLab(lab: Lab, action: 'approve' | 'reject' | 'pause') {
    const key = `lab:${lab.id}:${action}`;
    const reason = clean(reasonByKey[`lab:${lab.id}`]);

    if (action === 'reject' && !reason) {
      setErr('Rejection reason is required for lab rejection.');
      return;
    }

    setBusyKey(key);
    setErr(null);
    setNotice(null);

    const body =
      action === 'approve'
        ? {
            active: true,
            status: 'ACTIVE',
            onboardingStatus: 'APPROVED',
            rejectionReason: null,
            canManageStaff: lab.canManageStaff !== false,
            canPublishResults: lab.canPublishResults !== false,
          }
        : action === 'pause'
          ? {
              active: false,
              status: 'PENDING',
              onboardingStatus: 'PAUSED_BY_ADMIN',
              rejectionReason: reason || 'Paused by admin pending review',
            }
          : {
              active: false,
              status: 'REJECTED',
              onboardingStatus: 'REJECTED',
              rejectionReason: reason,
            };

    try {
      const res = await fetch(`/api/admin/medreach/labs/${encodeURIComponent(lab.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice(`Lab ${action} recorded.`);
      await load();
    } catch (e: any) {
      setErr(e?.message || `Unable to ${action} lab`);
    } finally {
      setBusyKey(null);
    }
  }

  async function patchPhleb(phleb: Phleb, action: 'approve' | 'reject' | 'pause') {
    const key = `phleb:${phleb.id}:${action}`;
    const reason = clean(reasonByKey[`phleb:${phleb.id}`]);

    if (action === 'reject' && !reason) {
      setErr('Rejection reason is required for phleb rejection.');
      return;
    }

    setBusyKey(key);
    setErr(null);
    setNotice(null);

    const body =
      action === 'approve'
        ? {
            active: true,
            approvalStatus: 'ACTIVE',
            rejectionReason: null,
          }
        : action === 'pause'
          ? {
              active: false,
              approvalStatus: 'PENDING',
              rejectionReason: reason || 'Paused by admin pending review',
            }
          : {
              active: false,
              approvalStatus: 'REJECTED',
              rejectionReason: reason,
            };

    try {
      const phlebRef = phleb.id || phleb.userId || '';

      if (!phlebRef) {
        throw new Error('Missing phleb id/userId for admin decision.');
      }

      const res = await fetch(
        `/api/admin/medreach/phlebs/${encodeURIComponent(phlebRef)}/profile`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice(`Phleb ${action} recorded.`);
      await load();
    } catch (e: any) {
      setErr(e?.message || `Unable to ${action} phleb`);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">
            MedReach Onboarding / KYI-KYC Control Centre
          </h1>
          <p className="mt-1 max-w-4xl text-sm text-gray-600">
            Admin governance surface for lab partner approval, lab readiness, phleb KYI
            readiness, payout configuration, default-lab routing and live-operations release.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/labs"
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Labs
          </Link>
          <Link
            href="/phleb"
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Phleb jobs
          </Link>
          <button
            type="button"
            onClick={load}
            className="rounded-full border bg-gray-900 px-3 py-1 text-white hover:bg-black"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Labs"
          value={loading ? '...' : summary.totalLabs}
          hint={`${summary.activeLabs} active / ${summary.pendingLabs} pending`}
        />
        <StatCard
          label="Phlebs"
          value={loading ? '...' : summary.totalPhlebs}
          hint={`${summary.activePhlebs} active / ${summary.pendingPhlebs} pending`}
        />
        <StatCard
          label="Rejected"
          value={loading ? '...' : summary.rejectedLabs + summary.rejectedPhlebs}
          hint="Labs + phlebs"
        />
        <StatCard
          label="Blocked readiness"
          value={loading ? '...' : summary.blocked}
          hint="Missing operational gates"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          {(['all', 'pending', 'active', 'rejected', 'blocked'] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-3 py-1 ${
                filter === item
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm md:max-w-sm"
          placeholder="Search lab/phleb/user/default lab"
        />
      </section>

      {notice ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Lab partner readiness</h2>
            <p className="mt-1 text-xs text-gray-500">
              Lab should not go live unless approved, staffed, tests/panels are present,
              payout is configured and result publishing is governed.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
              Loading labs...
            </div>
          ) : filteredLabs.length === 0 ? (
            <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
              No lab rows match this filter.
            </div>
          ) : (
            filteredLabs.map((lab) => {
              const readiness = labReadiness(lab);
              const status = labStatus(lab);
              const noteKey = `lab:${lab.id}`;
              const evidenceStats = evidenceSummary(
                evidenceBySubject.get(`lab:${lab.id}`) || [],
              );

              return (
                <article key={lab.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-950">{lab.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone(status)}`}>
                          {status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {lab.id} / {lab.contact || 'No contact'} / {lab.country || 'ZA'}{' '}
                        {lab.currency || 'ZAR'}
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-gray-700">
                      {readiness.score}/6 ready
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill ok={readiness.approved} text="Approved" />
                    <Pill ok={readiness.staff} text="Staff" />
                    <Pill ok={readiness.tests} text="Tests" />
                    <Pill ok={readiness.panels} text="Panels" />
                    <Pill ok={readiness.payout} text="Payout" />
                    <Pill ok={readiness.results} text="Results" />
                    <Pill
                      ok={evidenceStats.accepted > 0}
                      text={`Evidence accepted ${evidenceStats.accepted}`}
                    />
                    <Pill
                      ok={evidenceStats.pending === 0 && evidenceStats.submitted > 0}
                      text={`Pending docs ${evidenceStats.pending}`}
                    />
                    <Pill
                      ok={evidenceStats.rejected === 0 && evidenceStats.needsMoreInfo === 0}
                      text={`Review issues ${evidenceStats.rejected + evidenceStats.needsMoreInfo}`}
                    />
                    <Link
                      href={`/admin/medreach/evidence?subjectType=lab&subjectId=${encodeURIComponent(lab.id)}`}
                      className="rounded-full border bg-white px-2 py-0.5 text-[10px] hover:bg-gray-50"
                    >
                      Evidence review
                    </Link>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-gray-500">Tests</div>
                      <div className="font-semibold">{lab.counts?.offeredTests || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Panels</div>
                      <div className="font-semibold">{lab.counts?.panels || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Staff</div>
                      <div className="font-semibold">{lab.counts?.staffMembers || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Approved</div>
                      <div className="font-semibold">{fmtDate(lab.approvedAt)}</div>
                    </div>
                  </div>

                  {lab.rejectedAt ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      Rejected: {lab.rejectionReason || 'No reason supplied'}
                    </div>
                  ) : null}

                  <textarea
                    value={reasonByKey[noteKey] || ''}
                    onChange={(e) =>
                      setReasonByKey((prev) => ({ ...prev, [noteKey]: e.target.value }))
                    }
                    className="mt-4 w-full rounded border px-3 py-2 text-xs"
                    rows={2}
                    placeholder="Admin note / rejection reason / pause reason"
                  />

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchLab(lab, 'approve')}
                      className="rounded border bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800 disabled:bg-gray-200"
                    >
                      {busyKey === `lab:${lab.id}:approve` ? 'Working...' : 'Approve live'}
                    </button>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchLab(lab, 'pause')}
                      className="rounded border bg-white px-3 py-1 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchLab(lab, 'reject')}
                      className="rounded border bg-rose-700 px-3 py-1 text-white hover:bg-rose-800 disabled:bg-gray-200"
                    >
                      Reject
                    </button>
                    <Link
                      href={`/labs`}
                      className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                    >
                      Lab admin
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Phleb KYI readiness</h2>
            <p className="mt-1 text-xs text-gray-500">
              Phleb should not go live unless approved, active, payout-ready and linked to
              a default lab/coverage operating model.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
              Loading phlebs...
            </div>
          ) : filteredPhlebs.length === 0 ? (
            <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
              No phleb rows match this filter.
            </div>
          ) : (
            filteredPhlebs.map((phleb) => {
              const readiness = phlebReadiness(phleb);
              const status = phlebStatus(phleb);
              const noteKey = `phleb:${phleb.id}`;
              const evidenceStats = evidenceSummary(
                evidenceBySubject.get(`phleb:${phleb.id}`) ||
                  evidenceBySubject.get(`phleb:${phleb.userId || ''}`) ||
                  [],
              );

              return (
                <article key={phleb.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-950">
                          {phleb.userId || phleb.id}
                        </h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone(status)}`}>
                          {status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Profile {phleb.id} / {phleb.country || 'ZA'} {phleb.currency || 'ZAR'}
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-gray-700">
                      {readiness.score}/5 ready
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill ok={readiness.approved} text="Approved" />
                    <Pill ok={readiness.active} text="Active" />
                    <Pill ok={readiness.defaultLab} text="Default lab" />
                    <Pill ok={readiness.payout} text="Payout" />
                    <Pill ok={readiness.performance} text="Performance" />
                    <Pill
                      ok={evidenceStats.accepted > 0}
                      text={`Evidence accepted ${evidenceStats.accepted}`}
                    />
                    <Pill
                      ok={evidenceStats.pending === 0 && evidenceStats.submitted > 0}
                      text={`Pending docs ${evidenceStats.pending}`}
                    />
                    <Pill
                      ok={evidenceStats.rejected === 0 && evidenceStats.needsMoreInfo === 0}
                      text={`Review issues ${evidenceStats.rejected + evidenceStats.needsMoreInfo}`}
                    />
                    <Link
                      href={`/admin/medreach/evidence?subjectType=phleb&subjectId=${encodeURIComponent(phleb.id || phleb.userId || '')}`}
                      className="rounded-full border bg-white px-2 py-0.5 text-[10px] hover:bg-gray-50"
                    >
                      Evidence review
                    </Link>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-gray-500">Default lab</div>
                      <div className="truncate font-semibold">
                        {phleb.defaultLab?.name || phleb.defaultLabId || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Payout</div>
                      <div className="truncate font-semibold">
                        {phleb.payoutAccountMasked || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Completed</div>
                      <div className="font-semibold">{phleb.completedJobsCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Approved</div>
                      <div className="font-semibold">{fmtDate(phleb.approvedAt)}</div>
                    </div>
                  </div>

                  {phleb.rejectedAt ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      Rejected: {phleb.rejectionReason || 'No reason supplied'}
                    </div>
                  ) : null}

                  <textarea
                    value={reasonByKey[noteKey] || ''}
                    onChange={(e) =>
                      setReasonByKey((prev) => ({ ...prev, [noteKey]: e.target.value }))
                    }
                    className="mt-4 w-full rounded border px-3 py-2 text-xs"
                    rows={2}
                    placeholder="Admin note / rejection reason / pause reason"
                  />

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchPhleb(phleb, 'approve')}
                      className="rounded border bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800 disabled:bg-gray-200"
                    >
                      {busyKey === `phleb:${phleb.id}:approve` ? 'Working...' : 'Approve live'}
                    </button>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchPhleb(phleb, 'pause')}
                      className="rounded border bg-white px-3 py-1 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => patchPhleb(phleb, 'reject')}
                      className="rounded border bg-rose-700 px-3 py-1 text-white hover:bg-rose-800 disabled:bg-gray-200"
                    >
                      Reject
                    </button>
                    <Link
                      href={`/phleb`}
                      className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                    >
                      Phleb jobs
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}