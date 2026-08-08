'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, RefreshCw, ShieldAlert, UserRoundCog, XCircle } from 'lucide-react';
import {
  STATUS_LABELS,
  formatApplicationDate,
  formatApplicationValue,
  humanizeApplicationError,
  reviewActions,
  stageGovernanceNote,
  type AdminApplicationDetail,
  type ApplicationStatus,
  type ReviewerOption,
} from '../application-ui';

export const dynamic = 'force-dynamic';

type DetailPayload = { ok: boolean; application?: AdminApplicationDetail; error?: string };
type ReviewerPayload = { ok: boolean; reviewers?: ReviewerOption[]; error?: string };

export default function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const [application, setApplication] = useState<AdminApplicationDetail | null>(null);
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewerAccess, setReviewerAccess] = useState(true);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(params.id)}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as DetailPayload | null;
      if (!response.ok || !json?.ok || !json.application) {
        throw new Error(json?.error || 'application_detail_failed');
      }
      setApplication(json.application);
      setReviewerId(json.application.assignedReviewer?.id || '');
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function loadReviewers() {
    try {
      const response = await fetch('/api/admin/applications/reviewers', { cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as ReviewerPayload | null;
      if (response.status === 403) {
        setReviewerAccess(false);
        return;
      }
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_reviewer_list_failed');
      setReviewers(Array.isArray(json.reviewers) ? json.reviewers : []);
      setReviewerAccess(true);
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    }
  }

  useEffect(() => {
    void load();
    void loadReviewers();
  }, [params.id]);

  const groupedAnswers = useMemo(() => {
    const answers = application?.submission?.answers || [];
    const groups = new Map<string, typeof answers>();
    for (const answer of answers) {
      const key = `${answer.page?.order ?? 0}:${answer.page?.title || 'Form'} / ${answer.section?.order ?? 0}:${answer.section?.title || 'Responses'}`;
      const current = groups.get(key) || [];
      current.push(answer);
      groups.set(key, current);
    }
    return Array.from(groups.entries());
  }, [application]);

  async function assignReviewer() {
    if (!application || !reviewerAccess) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/assignment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewerProfileId: reviewerId || null, expectedUpdatedAt: application.updatedAt }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_assignment_failed');
      await load();
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function transition(toStatus: ApplicationStatus) {
    if (!application) return;
    let reason = '';
    if (toStatus === 'DECLINED') {
      reason = window.prompt('Internal decline reason (required; not included in the applicant notification)') || '';
      if (!reason.trim()) return;
      if (!window.confirm('Decline this application? This is a terminal recruitment decision.')) return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedStatus: application.status, toStatus, reason }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_transition_failed');
      await load();
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  if (!application && busy) return <main className="p-6 text-sm text-slate-500">Loading application…</main>;

  const actions = application ? reviewActions(application.status) : [];
  const governance = application ? stageGovernanceNote(application.status) : '';

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/admin/applications" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Applications</Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{application?.referenceCode || 'Application'}</h1>
          <p className="mt-2 text-sm text-slate-500">{application?.opportunity.title || ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh</button>
          {actions.map((action) => (
            <button key={action.toStatus} type="button" onClick={() => transition(action.toStatus)} disabled={busy} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${action.kind === 'danger' ? 'border border-rose-200 text-rose-700' : 'bg-slate-950 text-white'}`}>
              {action.kind === 'danger' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{action.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {governance ? <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900"><ShieldAlert className="mr-2 inline h-4 w-4" />{governance}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Status</div><div className="mt-1 font-semibold">{application ? STATUS_LABELS[application.status] : '—'}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Applicant</div><div className="mt-1 break-all font-medium">{application?.applicantEmailNormalized || 'Email not supplied'}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Submitted</div><div className="mt-1">{formatApplicationDate(application?.submittedAt)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Last reviewed</div><div className="mt-1">{formatApplicationDate(application?.lastReviewedAt)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Form version</div><div className="mt-1">v{application?.formVersion.versionNumber ?? '—'} · {application?.formVersion.title || 'Untitled version'}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Opportunity reference</div><div className="mt-1">{application?.opportunity.referenceCode || application?.opportunity.key || '—'}</div></div>
          </section>

          <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div><h2 className="text-lg font-semibold">Submitted responses</h2><p className="mt-1 text-sm text-slate-500">Sensitive fields remain redacted unless your effective role includes the dedicated sensitive-submission scope.</p></div>
            {!application?.submission?.canRead ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">You can review the Application record, but your role does not include <code>forms.submissions.read</code>.</div> : null}
            {application?.submission?.canRead ? groupedAnswers.map(([group, answers]) => (
              <div key={group} className="rounded-2xl border p-4">
                <h3 className="text-sm font-semibold text-slate-900">{group.replace(/^\d+:/, '').replace(/ \/ \d+:/, ' / ')}</h3>
                <div className="mt-3 divide-y">
                  {answers.sort((a, b) => a.order - b.order).map((answer) => (
                    <div key={answer.id} className="grid gap-2 py-3 md:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="text-sm font-medium text-slate-700">{answer.label}{answer.sensitive ? <span className="ml-2 text-[10px] uppercase text-rose-600">Sensitive</span> : null}</div>
                      {answer.redacted ? <div className="text-sm italic text-slate-400">Sensitive answer hidden</div> : <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">{formatApplicationValue(answer.value)}</pre>}
                    </div>
                  ))}
                </div>
              </div>
            )) : null}
          </section>

          <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div><h2 className="text-lg font-semibold">Submission evidence</h2><p className="mt-1 text-sm text-slate-500">This review view exposes metadata only. Secure file retrieval and re-request actions belong to the applicant-document workflow.</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              {(application?.submission?.files || []).map((file) => <div key={file.id} className="rounded-2xl border p-4"><div className="text-sm font-medium">{file.label}</div><div className="mt-1 text-xs text-slate-500">{file.redacted ? 'Sensitive file metadata hidden' : `${file.fileName || 'File'} · ${file.contentType || 'Unknown type'} · ${file.state}`}</div></div>)}
              {(application?.submission?.consents || []).map((consent) => <div key={consent.id} className="rounded-2xl border p-4"><div className="text-sm font-medium">{consent.label}</div><div className="mt-1 text-xs text-slate-500">{consent.redacted ? 'Sensitive consent evidence hidden' : consent.accepted ? `Accepted ${formatApplicationDate(consent.acceptedAt)}` : 'Not accepted'}</div></div>)}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><UserRoundCog className="h-5 w-5" /><h2 className="font-semibold">Reviewer assignment</h2></div>
            {reviewerAccess ? <><select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"><option value="">Unassigned</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name || reviewer.email}{reviewer.designation?.name ? ` · ${reviewer.designation.name}` : ''}</option>)}</select><button type="button" onClick={assignReviewer} disabled={busy || reviewerId === (application?.assignedReviewer?.id || '')} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save reviewer</button></> : <p className="mt-3 text-sm text-slate-500">You do not have reviewer-assignment permission.</p>}
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><FileText className="h-5 w-5" /><h2 className="font-semibold">Status history</h2></div>
            <div className="mt-4 space-y-4">
              {(application?.statusHistory || []).map((event) => <div key={event.id} className="border-l-2 border-slate-200 pl-3"><div className="text-sm font-medium">{event.fromStatus ? `${STATUS_LABELS[event.fromStatus]} → ` : ''}{STATUS_LABELS[event.toStatus]}</div><div className="mt-1 text-xs text-slate-500">{formatApplicationDate(event.createdAt)} · {event.actorType}</div>{event.reason ? <div className="mt-1 text-xs text-slate-600">{event.reason}</div> : null}</div>)}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
