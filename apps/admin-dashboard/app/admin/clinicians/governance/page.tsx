'use client';

import React from 'react';

type GovernanceAction = 'reinstate' | 'resolve' | 'keep_suspended' | 'archive';

type GovernanceRow = {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  specialty?: string | null;
  professionKey?: string | null;
  status?: string | null;
  disabled?: boolean;
  archived?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  governanceReview?: any;
  latestRating?: {
    id?: string;
    stars?: number;
    comment?: string | null;
    appointmentId?: string | null;
    patientId?: string | null;
    createdAt?: string | null;
  } | null;
  triggeredAt?: string | null;
  reason?: string | null;
  action?: string | null;
  severity?: string | null;
};

type DecisionDraft = {
  action: GovernanceAction;
  patientContactSummary: string;
  clinicianContactSummary: string;
  governanceAssessment: string;
  decisionRationale: string;
  safetyRisk: string;
};

const emptyDraft: DecisionDraft = {
  action: 'reinstate',
  patientContactSummary: '',
  clinicianContactSummary: '',
  governanceAssessment: '',
  decisionRationale: '',
  safetyRisk: 'not_recorded',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function stars(value?: number | null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'No rating';

  return `${n}/5`;
}

function statusClasses(row: GovernanceRow) {
  if (row.archived) return 'bg-slate-900 text-white';
  if (row.disabled || String(row.status || '').toLowerCase() === 'disciplinary') {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-emerald-100 text-emerald-800';
}

async function readJsonSafe(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export default function ClinicianGovernancePage() {
  const [rows, setRows] = React.useState<GovernanceRow[]>([]);
  const [scope, setScope] = React.useState<'active' | 'resolved' | 'all'>('active');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, DecisionDraft>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ scope, limit: '100' });
      if (query.trim()) params.set('q', query.trim());

      const res = await fetch(`/api/admin/clinicians/governance?${params.toString()}`, {
        cache: 'no-store',
      });

      const payload = await readJsonSafe(res);

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'governance_load_failed');
      }

      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(nextRows);

      setDrafts((current) => {
        const next = { ...current };

        for (const row of nextRows) {
          if (!next[row.id]) {
            next[row.id] = { ...emptyDraft };
          }
        }

        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'governance_load_failed');
    } finally {
      setLoading(false);
    }
  }, [scope, query]);

  React.useEffect(() => {
    load();
  }, [load]);

  function updateDraft(id: string, patch: Partial<DecisionDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || emptyDraft),
        ...patch,
      },
    }));
  }

  async function submitDecision(row: GovernanceRow) {
    const draft = drafts[row.id] || emptyDraft;

    if (!draft.decisionRationale.trim()) {
      setError('Decision rationale is required before saving a governance judgement.');
      return;
    }

    setSavingId(row.id);
    setError(null);

    try {
      const res = await fetch('/api/admin/clinicians/governance', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          clinicianId: row.id,
          action: draft.action,
          patientContactSummary: draft.patientContactSummary.trim() || null,
          clinicianContactSummary: draft.clinicianContactSummary.trim() || null,
          governanceAssessment: draft.governanceAssessment.trim() || null,
          decisionRationale: draft.decisionRationale.trim(),
          safetyRisk: draft.safetyRisk,
          evidenceReviewed: [
            row.latestRating?.id ? `ClinicianRating:${row.latestRating.id}` : '',
            row.latestRating?.appointmentId ? `Appointment:${row.latestRating.appointmentId}` : '',
          ].filter(Boolean),
        }),
      });

      const payload = await readJsonSafe(res);

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'governance_decision_failed');
      }

      await load();
    } catch (err: any) {
      setError(err?.message || 'governance_decision_failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
                Clinical governance
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Clinician review investigations
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Review clinicians automatically placed under governance hold after a serious rating
                or disciplinary trigger. Document the patient account, clinician response, assessment,
                and final judgement before reinstating, resolving, keeping suspended, or archiving.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-2">
              {(['active', 'resolved', 'all'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScope(item)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    scope === item
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {item === 'active' ? 'Active investigations' : item === 'resolved' ? 'Resolved' : 'All'}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clinician, specialty, reason..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading governance queue...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No clinicians found for this governance scope.
          </div>
        ) : (
          <div className="grid gap-5">
            {rows.map((row) => {
              const draft = drafts[row.id] || emptyDraft;
              const review = row.governanceReview || {};
              const history = Array.isArray(review.decisionHistory) ? review.decisionHistory : [];

              return (
                <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">{row.displayName || 'Unnamed clinician'}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(row)}`}>
                          {row.archived ? 'Archived' : row.disabled ? 'Disabled' : row.status || 'Status unknown'}
                        </span>
                        {review?.active ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            Active governance review
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {row.specialty || row.professionKey || 'Specialty not recorded'} · {row.email || row.userId || 'No email recorded'}
                      </p>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Current rating</p>
                          <p className="mt-1 text-lg font-bold">
                            {stars(row.ratingAvg)} <span className="text-sm font-medium text-slate-500">({row.ratingCount || 0})</span>
                          </p>
                        </div>

                        <div className="rounded-2xl bg-red-50 p-4">
                          <p className="text-xs font-semibold uppercase text-red-700">Trigger</p>
                          <p className="mt-1 text-sm font-semibold text-red-900">
                            {review.reason || row.reason || 'Governance trigger'}
                          </p>
                          <p className="mt-1 text-xs text-red-700">{formatDate(row.triggeredAt)}</p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Latest rating</p>
                          <p className="mt-1 text-sm font-semibold">{stars(row.latestRating?.stars)}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {row.latestRating?.comment || 'No patient comment recorded.'}
                          </p>
                        </div>
                      </div>

                      {review.patientContact?.summary || review.clinicianContact?.summary || review.decisionRationale ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Existing governance record</p>
                          {review.patientContact?.summary ? (
                            <p className="mt-2">
                              <span className="font-semibold">Patient account:</span> {review.patientContact.summary}
                            </p>
                          ) : null}
                          {review.clinicianContact?.summary ? (
                            <p className="mt-2">
                              <span className="font-semibold">Clinician response:</span> {review.clinicianContact.summary}
                            </p>
                          ) : null}
                          {review.decisionRationale ? (
                            <p className="mt-2">
                              <span className="font-semibold">Decision rationale:</span> {review.decisionRationale}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">Record investigation judgement</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Document both sides before making a decision. The rationale is required.
                      </p>

                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Decision
                          <select
                            value={draft.action}
                            onChange={(event) =>
                              updateDraft(row.id, { action: event.target.value as GovernanceAction })
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="reinstate">Reinstate clinician</option>
                            <option value="resolve">Resolve review</option>
                            <option value="keep_suspended">Keep suspended</option>
                            <option value="archive">Archive clinician</option>
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Safety risk level
                          <select
                            value={draft.safetyRisk}
                            onChange={(event) => updateDraft(row.id, { safetyRisk: event.target.value })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="not_recorded">Not recorded</option>
                            <option value="low">Low</option>
                            <option value="moderate">Moderate</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Patient side of story
                          <textarea
                            value={draft.patientContactSummary}
                            onChange={(event) => updateDraft(row.id, { patientContactSummary: event.target.value })}
                            rows={3}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            placeholder="Summarise patient contact, concern, and allegation."
                          />
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Clinician side of story
                          <textarea
                            value={draft.clinicianContactSummary}
                            onChange={(event) => updateDraft(row.id, { clinicianContactSummary: event.target.value })}
                            rows={3}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            placeholder="Summarise clinician response and context."
                          />
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Governance assessment
                          <textarea
                            value={draft.governanceAssessment}
                            onChange={(event) => updateDraft(row.id, { governanceAssessment: event.target.value })}
                            rows={3}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            placeholder="Summarise facts reviewed, clinical risk, and fairness considerations."
                          />
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Decision rationale <span className="text-red-700">*</span>
                          <textarea
                            value={draft.decisionRationale}
                            onChange={(event) => updateDraft(row.id, { decisionRationale: event.target.value })}
                            rows={3}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            placeholder="Explain what informed the final judgement."
                          />
                        </label>

                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => submitDecision(row)}
                          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {savingId === row.id ? 'Saving judgement...' : 'Save governance judgement'}
                        </button>
                      </div>

                      {history.length ? (
                        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                          <summary className="cursor-pointer font-bold text-slate-800">
                            Decision history ({history.length})
                          </summary>
                          <div className="mt-3 grid gap-3">
                            {history.slice().reverse().map((item: any, index: number) => (
                              <div key={index} className="rounded-xl bg-slate-50 p-3">
                                <p className="font-bold text-slate-900">
                                  {item.action || 'Decision'} · {formatDate(item.decidedAt)}
                                </p>
                                <p className="mt-1">{item.decisionRationale || 'No rationale recorded.'}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
