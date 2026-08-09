'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, RefreshCw, ShieldAlert, UploadCloud, UserRoundCog, XCircle } from 'lucide-react';
import {
  STATUS_LABELS,
  adminDocumentRequestExpired,
  canCompleteAdminDocumentCycle,
  documentRequestStatusLabel,
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
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentInstructions, setDocumentInstructions] = useState('');
  const [documentDueAt, setDocumentDueAt] = useState('');
  const [documentRequired, setDocumentRequired] = useState(true);
  const [documentRerequestDueAt, setDocumentRerequestDueAt] = useState<Record<string, string>>({});

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

  async function createDocumentRequest() {
    if (!application?.documents.canRequest || !documentTitle.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/documents/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: documentTitle.trim(),
          instructions: documentInstructions.trim(),
          dueAt: documentDueAt ? new Date(documentDueAt).toISOString() : null,
          required: documentRequired,
          allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
          maxFileSizeBytes: 15 * 1024 * 1024,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_document_request_failed');
      setDocumentTitle('');
      setDocumentInstructions('');
      setDocumentDueAt('');
      setDocumentRequired(true);
      await load();
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function reviewDocument(
    requestId: string,
    decision: 'ACCEPT' | 'REJECT' | 'REREQUEST',
    currentDueAt?: string | null,
  ) {
    if (!application?.documents.canReview) return;

    let reason = '';
    if (decision === 'REJECT' || decision === 'REREQUEST') {
      reason = window.prompt('Applicant-facing reason (required)') || '';
      if (!reason.trim()) return;
    }

    let dueAt: string | undefined;
    if (decision === 'REREQUEST') {
      const requestedDueAt = (documentRerequestDueAt[requestId] || '').trim();
      if (requestedDueAt) {
        const parsedDueAt = new Date(requestedDueAt);
        if (Number.isNaN(parsedDueAt.getTime())) {
          setError(humanizeApplicationError('application_document_due_date_invalid'));
          return;
        }
        if (parsedDueAt.getTime() <= Date.now()) {
          setError(humanizeApplicationError('application_document_due_date_must_be_future'));
          return;
        }
        dueAt = parsedDueAt.toISOString();
      } else if (adminDocumentRequestExpired(currentDueAt)) {
        setError(humanizeApplicationError('application_document_new_due_date_required'));
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/documents/requests/${encodeURIComponent(requestId)}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason, ...(dueAt ? { dueAt } : {}) }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_document_review_failed');
      if (decision === 'REREQUEST') {
        setDocumentRerequestDueAt((current) => {
          const next = { ...current };
          delete next[requestId];
          return next;
        });
      }
      await load();
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(fileId: string) {
    if (!application?.documents.canRead) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/documents/files/${encodeURIComponent(fileId)}/download`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json.downloadUrl) throw new Error(json?.error || 'application_document_download_failed');
      const opened = window.open(String(json.downloadUrl), '_blank', 'noopener,noreferrer');
      if (opened) opened.opener = null;
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    }
  }

  async function completeDocumentCycle() {
    if (!application?.documents.canReview) return;
    if (!window.confirm('Complete this document review cycle and return the application to its prior review stage?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(application.id)}/documents/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_document_cycle_completion_failed');
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
  const activeDocumentCycle = application?.documents.cycles.find((cycle) => cycle.status === 'OPEN') || null;
  const canStartOrAddDocumentRequest = Boolean(
    application?.documents.canRequest &&
    ['UNDER_REVIEW', 'SHORTLISTED', 'DOCUMENTS_REQUESTED'].includes(application.status),
  );

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
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold">Applicant documents</h2><p className="mt-1 text-sm text-slate-500">Governed requests use private object storage and short-lived authorised downloads. Applicant-facing review reasons are visible in the secure portal.</p></div>
              {activeDocumentCycle && application?.documents.canReview && canCompleteAdminDocumentCycle(activeDocumentCycle.requests) ? <button type="button" onClick={completeDocumentCycle} disabled={busy} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Complete document review</button> : null}
            </div>

            {!application?.documents.canRead ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your role does not include <code>applications.documents.read</code>.</div> : null}

            {application?.documents.canRead ? (application.documents.cycles.length ? application.documents.cycles.map((cycle) => (
              <div key={cycle.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Cycle {cycle.cycleNumber}</div><div className="text-xs uppercase tracking-wide text-slate-500">{cycle.status} · returns to {STATUS_LABELS[cycle.returnStatus]}</div></div>
                <div className="mt-3 space-y-3">
                  {cycle.requests.map((requestItem) => {
                    const currentFile = requestItem.files.find((file) => file.state === 'AVAILABLE') || null;
                    const canRerequest = Boolean(
                      application.documents.canReview &&
                      ['REQUESTED', 'RECEIVED', 'REJECTED'].includes(requestItem.status),
                    );
                    const deadlineExpired = adminDocumentRequestExpired(requestItem.dueAt);
                    return <div key={requestItem.id} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-semibold">{requestItem.title}{requestItem.required ? <span className="ml-2 text-[10px] uppercase text-rose-600">Required</span> : null}</div>{requestItem.instructions ? <div className="mt-1 text-xs text-slate-600">{requestItem.instructions}</div> : null}{requestItem.dueAt ? <div className="mt-1 text-xs text-slate-500">Due {formatApplicationDate(requestItem.dueAt)}</div> : null}</div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium">{documentRequestStatusLabel(requestItem.status)}</span></div>
                      {requestItem.reviewReason ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>Applicant-facing reason:</strong> {requestItem.reviewReason}</div> : null}
                      {currentFile ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-xs"><div><div className="font-medium">{currentFile.fileName}</div><div className="text-slate-500">{currentFile.contentType} · {Math.max(1, Math.round(currentFile.sizeBytes / 1024))} KB</div></div><button type="button" onClick={() => downloadDocument(currentFile.id)} className="inline-flex items-center gap-1 font-semibold text-cyan-700"><Download className="h-3.5 w-3.5" /> Secure download</button></div> : null}
                      {application.documents.canReview && requestItem.status === 'RECEIVED' ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => reviewDocument(requestItem.id, 'ACCEPT', requestItem.dueAt)} disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Accept</button><button type="button" onClick={() => reviewDocument(requestItem.id, 'REJECT', requestItem.dueAt)} disabled={busy} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">Reject</button></div> : null}
                      {canRerequest ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="text-xs font-medium text-amber-900">{deadlineExpired ? 'This request is overdue. Set a new future deadline before resending.' : 'Optional: set a new future deadline when resending this request.'}</div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input type="datetime-local" value={documentRerequestDueAt[requestItem.id] || ''} onChange={(event) => setDocumentRerequestDueAt((current) => ({ ...current, [requestItem.id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs" aria-label={`New deadline for ${requestItem.title}`} /><button type="button" onClick={() => reviewDocument(requestItem.id, 'REREQUEST', requestItem.dueAt)} disabled={busy || (deadlineExpired && !(documentRerequestDueAt[requestItem.id] || '').trim())} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-40">{requestItem.status === 'REQUESTED' ? (deadlineExpired ? 'Resend / extend request' : 'Resend request') : 'Request resubmission'}</button></div></div> : null}
                    </div>;
                  })}
                </div>
                {cycle.events.length ? (
                  <details className="mt-4 rounded-xl border bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">Document activity ({cycle.events.length})</summary>
                    <div className="mt-3 space-y-2">
                      {cycle.events.map((event) => (
                        <div key={event.id} className="border-l-2 border-slate-200 pl-3 text-xs">
                          <div className="font-medium">{event.action.replace(/_/g, ' ')}</div>
                          <div className="text-slate-500">{formatApplicationDate(event.createdAt)} · {event.actorType}</div>
                          {event.note ? <div className="mt-1 text-slate-600">{event.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            )) : <p className="text-sm text-slate-500">No applicant-document cycle has been opened.</p>) : null}

            {canStartOrAddDocumentRequest ? <div className="rounded-2xl border border-dashed p-4"><div className="flex items-center gap-2"><UploadCloud className="h-4 w-4" /><h3 className="text-sm font-semibold">Request a document</h3></div><div className="mt-3 grid gap-3 md:grid-cols-2"><input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Document title" className="rounded-xl border px-3 py-2 text-sm" /><input type="datetime-local" value={documentDueAt} onChange={(event) => setDocumentDueAt(event.target.value)} className="rounded-xl border px-3 py-2 text-sm" /><textarea value={documentInstructions} onChange={(event) => setDocumentInstructions(event.target.value)} placeholder="Applicant-facing instructions" className="min-h-24 rounded-xl border px-3 py-2 text-sm md:col-span-2" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={documentRequired} onChange={(event) => setDocumentRequired(event.target.checked)} /> Required document</label><button type="button" onClick={createDocumentRequest} disabled={busy || !documentTitle.trim()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Send secure document request</button></div><p className="mt-2 text-xs text-slate-500">Accepted file types: PDF, JPEG and PNG. Maximum 15 MB. This action moves eligible applications into Documents requested only when a real request is created.</p></div> : null}
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
