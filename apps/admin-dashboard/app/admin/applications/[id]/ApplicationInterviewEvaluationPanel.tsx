'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Scale, ShieldCheck } from 'lucide-react';
import { applicationEvaluationDecisionActions, canEditOwnInterviewEvaluation, interviewEvaluationStateLabel } from '../application-evaluation-ui';

type EvaluationField = {
  key: string;
  type: string;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  required?: boolean;
  sensitive?: boolean;
  calculated?: boolean;
  defaultValue?: unknown;
  validation?: unknown;
  config?: unknown;
  options?: Array<{ key: string; label: string; value: string; order: number }>;
};

type EvaluationPayload = {
  ok: boolean;
  error?: string;
  detail?: unknown;
  application?: {
    id: string;
    referenceCode: string;
    status: string;
  };
  eligibility?: {
    meetingId: string | null;
    meetingState: string | null;
    intervieweeAttended: boolean;
    attendingEvaluatorCount: number;
    canStart: boolean;
  };
  permissions?: {
    canEvaluate: boolean;
    canDecision: boolean;
    canReadPanel: boolean;
    canReadSensitive: boolean;
    canEvaluateSelf: boolean;
  };
  formOptions?: Array<{
    id: string;
    formId: string;
    formKey: string;
    formName: string;
    title: string;
    versionNumber: number;
  }>;
  cycle?: null | {
    id: string;
    status: 'OPEN' | 'COMPLETED';
    aggregateScore: number | null;
    openedAt: string;
    completedAt: string | null;
    meeting: {
      id: string;
      state: string;
      startsAt: string;
      endsAt: string;
      endedAt: string | null;
      timezone: string;
      title: string;
    };
    form: {
      id: string;
      key: string;
      name: string;
      versionId: string;
      versionNumber: number;
      title: string;
    };
    definition: {
      pages: Array<{
        key: string;
        title: string;
        description?: string | null;
        order: number;
        sections: Array<{
          key: string;
          title: string;
          description?: string | null;
          order: number;
          fields: EvaluationField[];
        }>;
      }>;
    };
    evaluations: Array<{
      id: string;
      evaluatorProfileId: string;
      evaluator: {
        id: string;
        email: string;
        name: string | null;
        designation?: { name: string } | null;
      };
      state: 'DRAFT' | 'SUBMITTED' | 'WAIVED';
      score: number | null;
      submittedAt: string | null;
      waivedAt: string | null;
      waiverReason: string | null;
      isSelf: boolean;
      answers: Array<{
        fieldKey: string;
        label: string;
        sensitive: boolean;
        redacted: boolean;
        value: unknown;
      }>;
    }>;
    selfAnswers: Record<string, unknown>;
    decisions: Array<{
      id: string;
      decision: 'SUCCESSFUL' | 'OFFERED' | 'DECLINED';
      fromStatus: string;
      reason: string | null;
      applicantMessage: string | null;
      aggregateScore: number | null;
      createdAt: string;
      actor: { id: string; name: string | null; email: string };
    }>;
  };
};

function evaluationError(code: string) {
  const map: Record<string, string> = {
    application_interview_evaluation_load_failed: 'Interview evaluation details could not be loaded.',
    application_interview_evaluation_form_required: 'Choose a published internal evaluation form.',
    application_interview_evaluation_form_not_available: 'That evaluation form is no longer available.',
    application_interview_evaluation_form_incompatible: 'That form uses structures that are not permitted for interview evaluation.',
    application_interview_evaluation_not_ready: 'Evaluation can start only after the interview has ended and attendance is recorded for the applicant and at least one interviewer.',
    application_interview_evaluation_cycle_exists: 'An interview evaluation cycle already exists for this application.',
    application_interview_evaluation_not_assigned: 'You are not an attending interviewer assigned to this evaluation.',
    application_interview_evaluation_not_editable: 'This evaluation can no longer be edited.',
    application_interview_evaluation_validation_failed: 'Complete the required evaluation fields before submitting.',
    application_interview_evaluation_submission_required: 'At least one submitted interviewer evaluation is required.',
    application_interview_evaluation_waiver_reason_required: 'A waiver reason is required.',
    application_recruitment_decision_not_available: 'That recruitment decision is not available from the current application stage.',
    application_recruitment_decision_reason_required: 'An internal reason is required for a decline decision.',
    application_offer_message_required: 'Enter the applicant-facing offer message before marking the application as offered.',
    application_status_changed_concurrently: 'The application status changed elsewhere. Refresh before continuing.',
  };
  return map[code] || code.replace(/_/g, ' ') || 'Something went wrong.';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function fieldDefault(field: EvaluationField) {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue;
  if (['BOOLEAN', 'CHECKBOX', 'CONSENT'].includes(field.type)) return false;
  if (['MULTI_SELECT', 'CHECKBOX_GROUP'].includes(field.type)) return [];
  return '';
}

function EvaluationInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: EvaluationField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (field.type === 'HIDDEN') return null;
  if (field.calculated) {
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
        <div className="font-medium">{field.label}</div>
        <p className="mt-1 text-xs text-slate-500">Calculated by the frozen Enterprise Form definition when the evaluation is submitted.</p>
      </div>
    );
  }
  if (field.type === 'INFORMATION') {
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
        <div className="font-medium">{field.label}</div>
        {field.helpText ? <p className="mt-1 text-xs text-slate-500">{field.helpText}</p> : null}
      </div>
    );
  }

  const label = (
    <span className="mb-1 block text-sm font-medium">
      {field.label}
      {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
      {field.sensitive ? <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">Sensitive</span> : null}
    </span>
  );

  if (['BOOLEAN', 'CHECKBOX', 'CONSENT'].includes(field.type)) {
    return (
      <label className="flex items-start gap-2 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">{field.label}{field.required ? ' *' : ''}</span>
          {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
        </span>
      </label>
    );
  }

  if (['SINGLE_SELECT', 'RADIO'].includes(field.type)) {
    return (
      <label className="block">
        {label}
        <select
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {(field.options || []).map((option) => (
            <option key={option.key} value={option.value}>{option.label}</option>
          ))}
        </select>
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </label>
    );
  }

  if (['MULTI_SELECT', 'CHECKBOX_GROUP'].includes(field.type)) {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    return (
      <fieldset className="rounded-xl border p-3">
        <legend className="px-1 text-sm font-medium">{field.label}{field.required ? ' *' : ''}</legend>
        <div className="space-y-2">
          {(field.options || []).map((option) => (
            <label key={option.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.has(option.value)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  onChange(Array.from(next));
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
        {field.helpText ? <p className="mt-2 text-xs text-slate-500">{field.helpText}</p> : null}
      </fieldset>
    );
  }

  if (field.type === 'LONG_TEXT') {
    return (
      <label className="block">
        {label}
        <textarea
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || ''}
          className="min-h-28 w-full rounded-xl border px-3 py-2 text-sm"
        />
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </label>
    );
  }

  const type = field.type === 'DATE'
    ? 'date'
    : field.type === 'DATETIME'
      ? 'datetime-local'
      : field.type === 'TIME'
        ? 'time'
        : ['NUMBER', 'CURRENCY', 'RATING'].includes(field.type)
          ? 'number'
          : field.type === 'EMAIL'
            ? 'email'
            : field.type === 'URL'
              ? 'url'
              : field.type === 'PHONE'
                ? 'tel'
                : 'text';

  return (
    <label className="block">
      {label}
      <input
        type={type}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(event) => {
          if (['NUMBER', 'CURRENCY', 'RATING'].includes(field.type)) {
            onChange(event.target.value === '' ? '' : Number(event.target.value));
          } else {
            onChange(event.target.value);
          }
        }}
        placeholder={field.placeholder || ''}
        min={field.type === 'RATING' ? 1 : undefined}
        max={field.type === 'RATING' ? 10 : undefined}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />
      {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
    </label>
  );
}

export function ApplicationInterviewEvaluationPanel({
  applicationId,
  onApplicationChanged,
}: {
  applicationId: string;
  onApplicationChanged: () => Promise<void> | void;
}) {
  const [payload, setPayload] = useState<EvaluationPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [formVersionId, setFormVersionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const response = await fetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluations`,
        { cache: 'no-store' },
      );
      const json = (await response.json().catch(() => null)) as EvaluationPayload | null;
      if (response.status === 403) {
        setPayload(null);
        return;
      }
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_interview_evaluation_load_failed');
      setPayload(json);
      setAnswers(json.cycle?.selfAnswers || {});
      if (!formVersionId && json.formOptions?.length) setFormVersionId(json.formOptions[0].id);
    } catch (err: any) {
      setError(evaluationError(err?.message));
    }
  }

  useEffect(() => {
    void load();
  }, [applicationId]);

  const selfEvaluation = payload?.cycle?.evaluations.find((evaluation) => evaluation.isSelf) || null;
  const allFields = useMemo(
    () => payload?.cycle?.definition.pages.flatMap((page) => page.sections.flatMap((section) => section.fields)) || [],
    [payload?.cycle],
  );
  const decisionActions = applicationEvaluationDecisionActions(payload?.application?.status || '', payload?.cycle?.status || '');

  useEffect(() => {
    if (!payload?.cycle || !selfEvaluation) return;
    setAnswers((current) => {
      const next = { ...current };
      for (const field of allFields) {
        if (field.calculated) continue;
        if (next[field.key] === undefined) next[field.key] = fieldDefault(field);
      }
      return next;
    });
  }, [payload?.cycle?.id, selfEvaluation?.id]);

  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'application_interview_evaluation_load_failed');
      await Promise.all([load(), Promise.resolve(onApplicationChanged())]);
      return true;
    } catch (err: any) {
      setError(evaluationError(err?.message));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function startCycle() {
    if (!formVersionId) return;
    await mutate(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluations`,
      'POST',
      { formVersionId },
    );
  }

  async function saveDraft() {
    await mutate(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluations/me`,
      'PATCH',
      { answers },
    );
  }

  async function submitEvaluation() {
    if (!window.confirm('Submit this interview evaluation? Submitted evaluations are locked and contribute to the governed panel score.')) return;
    await mutate(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluations/me`,
      'POST',
      { answers },
    );
  }

  async function waiveEvaluation(evaluationId: string, evaluatorName: string) {
    const reason = window.prompt(`Reason for waiving ${evaluatorName}'s evaluation (required)`) || '';
    if (!reason.trim()) return;
    if (!window.confirm('Waive this assigned evaluation? The waiver is audited and cannot substitute for the requirement that at least one interviewer submits an evaluation.')) return;
    await mutate(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluations/${encodeURIComponent(evaluationId)}/waive`,
      'POST',
      { reason },
    );
  }

  async function decide(decision: 'SUCCESSFUL' | 'OFFERED' | 'DECLINED') {
    const currentStatus = payload?.application?.status || '';
    if (!currentStatus) return;

    let reason = '';
    let applicantMessage = '';

    if (decision === 'DECLINED') {
      reason = window.prompt('Internal decline reason (required; retained in the audit trail)') || '';
      if (!reason.trim()) return;
      applicantMessage = window.prompt('Optional applicant-facing decline message') || '';
      if (!window.confirm('Record a terminal decline decision for this application?')) return;
    } else if (decision === 'OFFERED') {
      applicantMessage = window.prompt('Applicant-facing offer message (required)') || '';
      if (!applicantMessage.trim()) return;
      reason = window.prompt('Optional internal decision note') || '';
      if (!window.confirm('Mark this application as Offered and send the applicant-facing offer update?')) return;
    } else {
      reason = window.prompt('Optional internal successful-decision note') || '';
      if (!window.confirm('Mark this application as Successful? This records a positive decision stage but does not send an offer message.')) return;
    }

    await mutate(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/decision`,
      'POST',
      {
        expectedStatus: currentStatus,
        decision,
        reason,
        applicantMessage,
      },
    );
  }

  if (!payload && !error) return null;

  return (
    <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-2"><ClipboardCheck className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-semibold">Interview evaluation & decision</h2>
          <p className="mt-1 text-sm text-slate-500">Evaluator assignments come from actual interview attendance. Evaluation forms reuse the published internal Enterprise Form engine; scoring is calculated server-side from the frozen form version.</p>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {payload?.eligibility ? (
        <div className="grid gap-3 rounded-2xl border bg-slate-50 p-4 text-sm md:grid-cols-3">
          <div><div className="text-xs uppercase tracking-wide text-slate-500">Meeting</div><div className="mt-1 font-medium">{payload.eligibility.meetingState || 'Not available'}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-slate-500">Applicant attendance</div><div className="mt-1 font-medium">{payload.eligibility.intervieweeAttended ? 'Recorded' : 'Not recorded'}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-slate-500">Attending evaluators</div><div className="mt-1 font-medium">{payload.eligibility.attendingEvaluatorCount}</div></div>
        </div>
      ) : null}

      {payload?.eligibility?.canStart && !payload.cycle ? (
        <div className="rounded-2xl border border-dashed p-4">
          <h3 className="text-sm font-semibold">Open evaluation cycle</h3>
          <p className="mt-1 text-xs text-slate-500">Only published <code>INTERNAL</code> forms compatible with the interview-evaluation profile are offered. Branching, repeaters and file uploads are intentionally excluded from this workflow.</p>
          {payload.formOptions?.length ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select value={formVersionId} onChange={(event) => setFormVersionId(event.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm">
                {payload.formOptions.map((form) => <option key={form.id} value={form.id}>{form.formName} · {form.title} · v{form.versionNumber}</option>)}
              </select>
              <button type="button" disabled={busy || !formVersionId} onClick={startCycle} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Open governed evaluation</button>
            </div>
          ) : <p className="mt-3 text-sm text-amber-700">No compatible published INTERNAL evaluation form is available. Create and publish one in Enterprise Forms first.</p>}
        </div>
      ) : null}

      {payload?.cycle ? (
        <>
          <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-3">
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Evaluation form</div><div className="mt-1 font-semibold">{payload.cycle.form.name} · v{payload.cycle.form.versionNumber}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Cycle</div><div className="mt-1 font-semibold">{payload.cycle.status}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-slate-500">Aggregate score</div><div className="mt-1 font-semibold">{!payload.permissions?.canDecision ? 'Restricted' : payload.cycle.aggregateScore == null ? (payload.cycle.status === 'OPEN' ? 'Pending' : 'Not scored') : Number(payload.cycle.aggregateScore).toFixed(2)}</div></div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Panel evaluations</h3>
            {payload.cycle.evaluations.map((evaluation) => {
              const name = evaluation.evaluator.name || evaluation.evaluator.email;
              return (
                <div key={evaluation.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><div className="font-medium">{name}{evaluation.evaluator.designation?.name ? ` · ${evaluation.evaluator.designation.name}` : ''}</div><div className="mt-1 text-xs text-slate-500">{interviewEvaluationStateLabel(evaluation.state)}{evaluation.submittedAt ? ` · ${formatDate(evaluation.submittedAt)}` : ''}{evaluation.score == null ? '' : ` · score ${Number(evaluation.score).toFixed(2)}`}</div></div>
                    {payload.permissions?.canDecision && evaluation.state === 'DRAFT' ? <button type="button" disabled={busy} onClick={() => waiveEvaluation(evaluation.id, name)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800">Waive with reason</button> : null}
                  </div>
                  {evaluation.waiverReason ? <p className="mt-2 text-xs text-amber-700">Waiver: {evaluation.waiverReason}</p> : null}
                  {evaluation.answers.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{evaluation.answers.map((answer) => <div key={answer.fieldKey} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="font-medium">{answer.label}</div><div className="mt-1 whitespace-pre-wrap text-slate-600">{answer.redacted ? 'Sensitive answer hidden by form-submission scope.' : displayValue(answer.value)}</div></div>)}</div> : null}
                </div>
              );
            })}
          </div>

          {selfEvaluation && canEditOwnInterviewEvaluation({ canEvaluateSelf: Boolean(payload.permissions?.canEvaluateSelf), evaluationState: selfEvaluation.state, cycleStatus: payload.cycle.status }) ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Your assigned evaluation</h3></div>
              <div className="mt-4 space-y-5">
                {payload.cycle.definition.pages.map((page) => (
                  <div key={page.key} className="space-y-4">
                    <div><div className="font-semibold">{page.title}</div>{page.description ? <p className="mt-1 text-xs text-slate-500">{page.description}</p> : null}</div>
                    {page.sections.map((section) => (
                      <div key={section.key} className="space-y-3 rounded-2xl bg-white p-4">
                        <div><div className="text-sm font-semibold">{section.title}</div>{section.description ? <p className="mt-1 text-xs text-slate-500">{section.description}</p> : null}</div>
                        {section.fields.map((field) => <EvaluationInput key={field.key} field={field} value={answers[field.key]} disabled={busy} onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))} />)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={saveDraft} disabled={busy} className="rounded-xl border px-4 py-2 text-sm font-semibold">Save draft</button><button type="button" onClick={submitEvaluation} disabled={busy} className="rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-white">Submit evaluation</button></div>
            </div>
          ) : null}

          {selfEvaluation?.state === 'SUBMITTED' ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Your evaluation is submitted and locked.</div> : null}

          {payload.permissions?.canDecision && decisionActions.length > 0 ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex items-center gap-2"><Scale className="h-4 w-4" /><h3 className="text-sm font-semibold">Governed recruitment decision</h3></div>
              <p className="mt-1 text-xs text-slate-600">The decision is written to immutable decision history, Application status history and AuditLog. An offer requires an explicit applicant-facing message.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {decisionActions.includes('SUCCESSFUL') ? <button type="button" disabled={busy} onClick={() => decide('SUCCESSFUL')} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Mark successful</button> : null}
                {decisionActions.includes('OFFERED') ? <button type="button" disabled={busy} onClick={() => decide('OFFERED')} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Mark offered</button> : null}
                {decisionActions.includes('DECLINED') ? <button type="button" disabled={busy} onClick={() => decide('DECLINED')} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700">Decline after interview</button> : null}
              </div>
            </div>
          ) : null}

          {payload.cycle.decisions.length ? <div className="space-y-2"><h3 className="text-sm font-semibold">Decision history</h3>{payload.cycle.decisions.map((decision) => <div key={decision.id} className="rounded-xl border p-3 text-sm"><div className="font-semibold">{decision.fromStatus} → {decision.decision}</div><div className="mt-1 text-xs text-slate-500">{formatDate(decision.createdAt)} · {decision.actor.name || decision.actor.email}{decision.aggregateScore == null ? '' : ` · panel score ${Number(decision.aggregateScore).toFixed(2)}`}</div>{decision.reason ? <div className="mt-2 text-xs text-slate-600">Internal reason: {decision.reason}</div> : null}{decision.applicantMessage ? <div className="mt-1 text-xs text-slate-600">Applicant message: {decision.applicantMessage}</div> : null}</div>)}</div> : null}
        </>
      ) : null}
    </section>
  );
}
