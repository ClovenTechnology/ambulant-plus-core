'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  accessTokenFromFragment,
  canUploadForRequest,
  canWithdrawFromPortal,
  canRespondToInterview,
  canResendInterviewInvite,
  interviewResponseLabel,
  formatPortalInterviewDate,
  humanizePortalError,
  normalisePortalReference,
  portalSessionStorageKey,
  portalDocumentRequestExpired,
  requestStatusLabel,
} from '../client-policy';
import type {
  ApplicationPortal,
  ApplicationPortalDocumentRequest,
} from '../types';

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  SHORTLISTED: 'Shortlisted',
  DOCUMENTS_REQUESTED: 'Documents requested',
  INTERVIEW_INVITED: 'Interview invited',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interview completed',
  SUCCESSFUL: 'Successful',
  OFFERED: 'Offer stage',
  ONBOARDING: 'Onboarding',
  DECLINED: 'Not progressing',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function ApplicationPortalClient({ reference }: { reference: string }) {
  const canonicalReference = useMemo(() => normalisePortalReference(reference), [reference]);
  const [token, setToken] = useState('');
  const [application, setApplication] = useState<ApplicationPortal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadingRequest, setUploadingRequest] = useState('');

  useEffect(() => {
    if (!canonicalReference) return;
    const fragmentToken = accessTokenFromFragment(window.location.hash);
    const storageKey = portalSessionStorageKey(canonicalReference);
    const stored = String(window.sessionStorage.getItem(storageKey) || '');
    const candidate = fragmentToken || (/^[A-Za-z0-9_-]{32,500}$/.test(stored) ? stored : '');
    if (fragmentToken) {
      window.sessionStorage.setItem(storageKey, fragmentToken);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setToken(candidate);
  }, [canonicalReference]);

  async function load(currentToken = token) {
    if (!canonicalReference || !currentToken) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/public/${encodeURIComponent(canonicalReference)}`, {
        cache: 'no-store',
        headers: { 'x-application-access-token': currentToken },
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json.application) {
        throw new Error(json?.error || 'application_portal_load_failed');
      }
      setApplication(json.application as ApplicationPortal);
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token) void load(token);
  }, [token]);

  async function upload(requestItem: ApplicationPortalDocumentRequest, file: File) {
    if (!token || !canUploadForRequest(requestItem.status)) return;
    setUploadingRequest(requestItem.id);
    setError('');
    try {
      const checksumSha256 = await sha256Hex(file);
      const presignResponse = await fetch(
        `/api/applications/public/${encodeURIComponent(canonicalReference)}/documents/${encodeURIComponent(requestItem.id)}/files/presign`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-application-access-token': token,
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            checksumSha256,
          }),
        },
      );
      const presign = await presignResponse.json().catch(() => null);
      if (!presignResponse.ok || !presign?.ok || !presign.uploadUrl || !presign.fileId) {
        throw new Error(presign?.error || 'application_document_presign_failed');
      }

      const uploadResponse = await fetch(String(presign.uploadUrl), {
        method: 'PUT',
        headers: presign.headers || {},
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('application_document_storage_upload_failed');

      const confirmResponse = await fetch(
        `/api/applications/public/${encodeURIComponent(canonicalReference)}/documents/${encodeURIComponent(requestItem.id)}/files/${encodeURIComponent(String(presign.fileId))}/confirm`,
        {
          method: 'POST',
          headers: { 'x-application-access-token': token },
        },
      );
      const confirmed = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirmed?.ok) {
        throw new Error(confirmed?.error || 'application_document_confirm_failed');
      }
      await load();
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setUploadingRequest('');
    }
  }

  async function removeFile(requestId: string, fileId: string) {
    if (!token || !window.confirm('Remove this uploaded file?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/applications/public/${encodeURIComponent(canonicalReference)}/documents/${encodeURIComponent(requestId)}/files/${encodeURIComponent(fileId)}`,
        {
          method: 'DELETE',
          headers: { 'x-application-access-token': token },
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_document_remove_failed');
      await load();
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function respondToInterview(responseValue: 'ACCEPT' | 'DECLINE') {
    if (!token || !application?.interview) return;
    if (responseValue === 'DECLINE' && !window.confirm('Decline this interview invitation? Your application will return to the shortlist stage.')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/public/${encodeURIComponent(canonicalReference)}/interview/respond`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-application-access-token': token,
        },
        body: JSON.stringify({ response: responseValue }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_interview_response_failed');
      await load();
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function resendInterviewInvite() {
    if (!token || !application?.interview) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/public/${encodeURIComponent(canonicalReference)}/interview/resend`, {
        method: 'POST',
        headers: { 'x-application-access-token': token },
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_interview_resend_failed');
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!token || !application) return;
    if (!window.confirm('Withdraw this application? This action changes your application status immediately.')) return;
    const reason = window.prompt('Optional reason for withdrawal') || '';
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/public/${encodeURIComponent(canonicalReference)}/withdraw`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-application-access-token': token,
        },
        body: JSON.stringify({ reason }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_withdrawal_failed');
      await load();
    } catch (err: any) {
      setError(humanizePortalError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  if (!canonicalReference) {
    return <main className="p-8 text-sm text-rose-700">Invalid application reference.</main>;
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Secure access required</h1>
          <p className="mt-3 text-sm text-slate-600">This portal requires the secure access credential sent to your application email.</p>
          <Link href={`/applications?reference=${encodeURIComponent(canonicalReference)}`} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Request a new access link</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Ambulant+ application</div>
          <h1 className="mt-2 text-3xl font-semibold">{application?.opportunity.title || canonicalReference}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="font-mono text-white">{canonicalReference}</span>
            <span>•</span>
            <span>{application ? STATUS_LABELS[application.status] || application.status : 'Loading…'}</span>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {busy && !application ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Loading secure application…</div> : null}

        {application ? (
          <>
            <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:grid-cols-3">
              <div><div className="text-xs uppercase tracking-wide text-slate-500">Status</div><div className="mt-1 font-semibold">{STATUS_LABELS[application.status] || application.status}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-slate-500">Submitted</div><div className="mt-1">{formatDate(application.submittedAt)}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-slate-500">Last status change</div><div className="mt-1">{formatDate(application.statusChangedAt)}</div></div>
            </section>

            {application.interview ? <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm"><div><h2 className="text-lg font-semibold">Interview</h2><p className="mt-1 text-sm text-slate-500">This interview uses Ambulant+ secure Meeting access. Your join link is sent separately to your application email.</p></div><div className="grid gap-3 sm:grid-cols-2"><div><div className="text-xs uppercase tracking-wide text-slate-500">Schedule</div><div className="mt-1 font-semibold">{formatPortalInterviewDate(application.interview.startsAt, application.interview.timezone)}</div><div className="text-xs text-slate-500">{application.interview.durationMinutes} minutes</div></div><div><div className="text-xs uppercase tracking-wide text-slate-500">Your response</div><div className="mt-1 font-semibold">{interviewResponseLabel(application.interview.intervieweeState)}</div></div></div>{application.interview.interviewers.length ? <div><div className="text-xs uppercase tracking-wide text-slate-500">Interview panel</div><div className="mt-2 flex flex-wrap gap-2">{application.interview.interviewers.map((item, index) => <span key={`${item.displayName}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{item.displayName}</span>)}</div></div> : null}{canRespondToInterview({ applicationStatus: application.status, intervieweeState: application.interview.intervieweeState, meetingState: application.interview.state }) ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => respondToInterview('ACCEPT')} disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept interview</button><button type="button" onClick={() => respondToInterview('DECLINE')} disabled={busy} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Decline this slot</button></div> : null}{canResendInterviewInvite({ applicationStatus: application.status, meetingState: application.interview.state }) ? <button type="button" onClick={resendInterviewInvite} disabled={busy} className="w-fit rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">Resend secure interview link</button> : null}<p className="text-xs text-slate-500">Declining the interview slot does not withdraw your application. It returns the application to the shortlist stage so Ambulant+ can issue another invitation if appropriate.</p></section> : null}

            <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
              <div><h2 className="text-lg font-semibold">Document requests</h2><p className="mt-1 text-sm text-slate-500">Files are uploaded directly to private storage using short-lived upload authorisation. Accepted documents cannot be replaced unless Ambulant+ requests a resubmission.</p></div>
              {application.documentCycles.length === 0 ? <p className="text-sm text-slate-500">There are no document requests for this application.</p> : null}
              {application.documentCycles.map((cycle) => (
                <div key={cycle.id} className="space-y-3 rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3"><div className="font-medium">Document review cycle {cycle.cycleNumber}</div><div className="text-xs uppercase tracking-wide text-slate-500">{cycle.status}</div></div>
                  {cycle.requests.map((requestItem) => {
                    const currentFile = requestItem.files.find((file) => file.state === 'AVAILABLE') || null;
                    const uploadable =
                      cycle.status === 'OPEN' &&
                      application.status === 'DOCUMENTS_REQUESTED' &&
                      canUploadForRequest(requestItem.status) &&
                      !portalDocumentRequestExpired(requestItem.dueAt);
                    return (
                      <div key={requestItem.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{requestItem.title}{requestItem.required ? <span className="ml-2 text-xs text-rose-600">Required</span> : null}</div>{requestItem.instructions ? <p className="mt-1 text-sm text-slate-600">{requestItem.instructions}</p> : null}</div><span className="rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm">{requestStatusLabel(requestItem.status)}</span></div>
                        {requestItem.dueAt ? <div className="mt-2 text-xs text-slate-500">Due {formatDate(requestItem.dueAt)}</div> : null}
                        {requestItem.reviewReason ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Reviewer message:</strong> {requestItem.reviewReason}</div> : null}
                        {currentFile ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm"><div><div className="font-medium">{currentFile.fileName}</div><div className="text-xs text-slate-500">{currentFile.contentType} · {formatBytes(currentFile.sizeBytes)}</div></div>{uploadable ? <button type="button" onClick={() => removeFile(requestItem.id, currentFile.id)} disabled={busy} className="text-xs font-semibold text-rose-700">Remove</button> : null}</div> : null}
                        {uploadable ? <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><input type="file" className="hidden" accept={requestItem.allowedContentTypes.join(',')} disabled={uploadingRequest === requestItem.id} onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void upload(requestItem, file); event.target.value = ''; }} />{uploadingRequest === requestItem.id ? 'Uploading…' : currentFile ? 'Replace file' : 'Upload document'}</label> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Status history</h2>
              <div className="mt-4 space-y-3">{application.statusHistory.map((event) => <div key={event.id} className="border-l-2 border-slate-200 pl-3 text-sm"><div className="font-medium">{STATUS_LABELS[event.toStatus] || event.toStatus}</div><div className="text-xs text-slate-500">{formatDate(event.createdAt)}</div></div>)}</div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/opportunities" className="text-sm font-medium text-cyan-700">Browse opportunities</Link>
              {canWithdrawFromPortal(application.status) ? <button type="button" onClick={withdraw} disabled={busy} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Withdraw application</button> : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
