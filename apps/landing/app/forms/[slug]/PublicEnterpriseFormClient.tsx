'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyAnswer,
  fieldByKey,
  fieldIssueMessage,
  isRecord,
  pageContainsField,
  parseResumeFragment,
  publicPageSequence,
  requiredFieldKeys,
  seedDefaultAnswers,
  translationText,
  visibleFieldKeys,
} from './client-policy';
import type {
  PublicFormDefinition,
  PublicFormField,
  PublicFormSection,
  PublicSubmission,
  PublicSubmissionFile,
  PublicSubmissionSession,
} from './types';

type FieldIssues = Record<string, string>;

type ApiError = Error & {
  status?: number;
  code?: string;
  detail?: unknown;
};

function storageKey(slug: string) {
  return `ambulant.enterprise-form.${slug}`;
}

function readStoredSession(slug: string): PublicSubmissionSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(slug)) || window.sessionStorage.getItem(storageKey(slug));
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);
    if (!value?.submissionId || !/^[A-Za-z0-9_-]{32,500}$/.test(String(value?.token || ''))) return null;
    if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) return null;
    return {
      submissionId: String(value.submissionId),
      token: String(value.token),
      expiresAt: value.expiresAt ? String(value.expiresAt) : null,
      allowSaveResume: Boolean(value.allowSaveResume),
    };
  } catch {
    return null;
  }
}

function persistSession(slug: string, session: PublicSubmissionSession) {
  if (typeof window === 'undefined') return;
  const key = storageKey(slug);
  const encoded = JSON.stringify(session);
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
  if (session.allowSaveResume) window.localStorage.setItem(key, encoded);
  else window.sessionStorage.setItem(key, encoded);
}

function clearStoredSession(slug: string) {
  if (typeof window === 'undefined') return;
  const key = storageKey(slug);
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

async function apiJson(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.ok === false) {
    const error = new Error(String(json?.error || 'form_request_failed')) as ApiError;
    error.status = response.status;
    error.code = String(json?.error || 'form_request_failed');
    error.detail = json?.detail;
    throw error;
  }

  return json;
}

function tokenHeaders(session: PublicSubmissionSession) {
  return { 'x-form-submission-token': session.token };
}

function errorText(error: unknown) {
  const code = String((error as ApiError)?.code || (error as Error)?.message || '');
  const map: Record<string, string> = {
    form_not_found: 'This form is unavailable or is no longer published.',
    form_not_accepting_submissions: 'This form is not accepting submissions at the moment.',
    form_submission_not_found: 'Your saved form session is no longer available. Start a new submission to continue.',
    form_submission_too_fast: 'Please review your answers for a moment before submitting.',
    form_rate_limited: 'Too many requests were received. Please wait a little and try again.',
    form_upload_content_type_rejected: 'That file type is not accepted for this field.',
    form_upload_size_rejected: 'That file is larger than the allowed size.',
    form_upload_file_limit_reached: 'The maximum number of files has already been uploaded.',
    form_upload_storage_not_configured: 'Secure file upload is temporarily unavailable. Please try again later.',
  };
  return map[code] || 'We could not complete that form action. Please try again.';
}

async function sha256Hex(file: File) {
  const digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function optionLabel(field: PublicFormField, value: string, locale: string, translations: PublicFormDefinition['version']['translations']) {
  const option = (field.options ?? []).find((entry) => entry.value === value);
  if (!option) return value;
  return translationText({
    translations,
    locale,
    targetType: 'OPTION',
    targetKey: option.key,
    property: 'label',
    fallback: option.label,
  });
}

function axisItems(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ key: string; label: string }>;
  return value
    .map((entry, index) => {
      if (typeof entry === 'string') return { key: entry, label: entry };
      if (isRecord(entry)) {
        const key = String(entry.key || entry.value || index).trim();
        const label = String(entry.label || entry.value || entry.key || index + 1).trim();
        return key ? { key, label } : null;
      }
      return null;
    })
    .filter((entry): entry is { key: string; label: string } => Boolean(entry));
}

export default function PublicEnterpriseFormClient({ slug }: { slug: string }) {
  const [form, setForm] = useState<PublicFormDefinition | null>(null);
  const [session, setSession] = useState<PublicSubmissionSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<PublicSubmissionFile[]>([]);
  const [locale, setLocale] = useState('en-ZA');
  const [pageKey, setPageKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldIssues, setFieldIssues] = useState<FieldIssues>({});
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const resumedOnce = useRef(false);

  const translations = form?.version.translations ?? [];
  const pages = useMemo(() => (form ? publicPageSequence(form, answers) : []), [form, answers]);
  const visible = useMemo(() => (form ? visibleFieldKeys(form, answers) : new Set<string>()), [form, answers]);
  const required = useMemo(() => (form ? requiredFieldKeys(form, answers) : new Set<string>()), [form, answers]);
  const currentPage = pages.find((page) => page.key === pageKey) || pages[0] || null;
  const currentIndex = currentPage ? pages.findIndex((page) => page.key === currentPage.key) : -1;

  const locales = useMemo(() => {
    const values = new Set<string>();
    if (form?.version.locale) values.add(form.version.locale);
    if (form?.version.fallbackLocale) values.add(form.version.fallbackLocale);
    for (const entry of translations) if (entry.locale) values.add(entry.locale);
    return [...values];
  }, [form?.version.locale, form?.version.fallbackLocale, translations]);

  const initialiseRepeatCounts = useCallback((definition: PublicFormDefinition, valueMap: Record<string, unknown>) => {
    const counts: Record<string, number> = {};
    for (const page of definition.version.pages) {
      for (const section of page.sections) {
        if (!section.repeatable) continue;
        const fromAnswers = Math.max(
          0,
          ...section.fields.map((field) => Array.isArray(valueMap[field.key]) ? (valueMap[field.key] as unknown[]).length : 0),
        );
        counts[section.key] = Math.max(Number(section.minRepeats ?? 0), fromAnswers, 1);
      }
    }
    setRepeatCounts(counts);
  }, []);

  const applySubmission = useCallback((submission: PublicSubmission, activeSession: PublicSubmissionSession) => {
    setForm(submission.form);
    setAnswers({ ...seedDefaultAnswers(submission.form), ...(submission.answers || {}) });
    setFiles(submission.files || []);
    setLocale(submission.locale || submission.form.version.locale || 'en-ZA');
    setSession(activeSession);
    persistSession(slug, activeSession);
    initialiseRepeatCounts(submission.form, submission.answers || {});
  }, [initialiseRepeatCounts, slug]);

  const resume = useCallback(async (candidate: PublicSubmissionSession) => {
    const json = await apiJson(
      `/api/forms/public/submissions/${encodeURIComponent(candidate.submissionId)}`,
      { headers: tokenHeaders(candidate) },
    );
    const submission = json.submission as PublicSubmission;
    const activeSession: PublicSubmissionSession = {
      ...candidate,
      expiresAt: submission.expiresAt || candidate.expiresAt,
      allowSaveResume: submission.form.version.allowSaveResume,
    };
    applySubmission(submission, activeSession);
    setNotice('Your saved progress has been restored.');
  }, [applySubmission]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const json = await apiJson(`/api/forms/public/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        const definition = json.form as PublicFormDefinition;
        setForm(definition);
        const initialAnswers = seedDefaultAnswers(definition);
        setAnswers(initialAnswers);
        setLocale(definition.version.locale || 'en-ZA');
        initialiseRepeatCounts(definition, initialAnswers);
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [initialiseRepeatCounts, slug]);

  useEffect(() => {
    if (!form || resumedOnce.current || typeof window === 'undefined') return;
    resumedOnce.current = true;

    const fragment = parseResumeFragment(window.location.hash);
    const stored = readStoredSession(slug);
    const candidate = fragment
      ? {
          submissionId: fragment.submissionId,
          token: fragment.token,
          allowSaveResume: true,
        }
      : stored;

    if (fragment) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!candidate) return;

    setBusy(true);
    resume(candidate)
      .catch(() => {
        clearStoredSession(slug);
        setNotice('A previous saved session could not be restored. You can start a new submission.');
      })
      .finally(() => setBusy(false));
  }, [form, resume, slug]);

  useEffect(() => {
    if (!pages.length) return;
    if (!pageKey || !pages.some((page) => page.key === pageKey)) {
      setPageKey(pages[0].key);
    }
  }, [pageKey, pages]);

  function translated(targetType: string, targetKey: string, property: string, fallback?: string | null) {
    return translationText({ translations, locale, targetType, targetKey, property, fallback });
  }

  function setScalar(fieldKey: string, value: unknown) {
    setAnswers((current) => ({ ...current, [fieldKey]: value }));
    setFieldIssues((current) => {
      if (!current[fieldKey]) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  }

  function setRepeatValue(fieldKey: string, index: number, value: unknown) {
    setAnswers((current) => {
      const values = Array.isArray(current[fieldKey]) ? [...(current[fieldKey] as unknown[])] : [];
      while (values.length <= index) values.push('');
      values[index] = value;
      return { ...current, [fieldKey]: values };
    });
  }

  function addRepeat(section: PublicFormSection) {
    const current = repeatCounts[section.key] || 0;
    const max = Number(section.maxRepeats ?? 100);
    if (current >= max) return;
    setRepeatCounts((counts) => ({ ...counts, [section.key]: current + 1 }));
  }

  function removeRepeat(section: PublicFormSection, index: number) {
    const current = repeatCounts[section.key] || 0;
    const min = Number(section.minRepeats ?? 0);
    if (current <= min) return;

    setAnswers((valueMap) => {
      const next = { ...valueMap };
      for (const field of section.fields) {
        const values = Array.isArray(next[field.key]) ? [...(next[field.key] as unknown[])] : [];
        values.splice(index, 1);
        next[field.key] = values;
      }
      return next;
    });
    setRepeatCounts((counts) => ({ ...counts, [section.key]: Math.max(min, current - 1) }));
  }

  function applyServerIssues(detail: unknown) {
    const next: FieldIssues = {};
    if (Array.isArray(detail)) {
      for (const issue of detail) {
        if (!isRecord(issue)) continue;
        const fieldKey = String(issue.fieldKey || '').trim();
        const code = String(issue.code || '').trim();
        const field = form && fieldByKey(form, fieldKey);
        if (fieldKey) next[fieldKey] = fieldIssueMessage(code, field?.label || fieldKey);
      }
    }
    setFieldIssues(next);

    const firstKey = Object.keys(next)[0];
    if (firstKey && form) {
      const targetPage = pages.find((page) => pageContainsField(page, firstKey));
      if (targetPage) setPageKey(targetPage.key);
      window.setTimeout(() => document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }

  async function startForm() {
    if (!form) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const json = await apiJson(`/api/forms/public/${encodeURIComponent(slug)}/start`, {
        method: 'POST',
        body: JSON.stringify({ locale, __website: honeypot }),
      });
      const activeSession: PublicSubmissionSession = {
        submissionId: String(json.submissionId),
        token: String(json.submissionToken),
        expiresAt: json.expiresAt ? String(json.expiresAt) : null,
        allowSaveResume: Boolean(json.allowSaveResume),
      };
      setSession(activeSession);
      persistSession(slug, activeSession);
      setPageKey(pages[0]?.key || '');
      setNotice(activeSession.allowSaveResume ? 'Your secure form session has started. Progress can be saved on this device.' : 'Your secure form session has started.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress(showNotice = true) {
    if (!session) return false;
    setBusy(true);
    setError('');
    if (showNotice) setNotice('');
    try {
      const json = await apiJson(
        `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}`,
        {
          method: 'PATCH',
          headers: tokenHeaders(session),
          body: JSON.stringify({ answers }),
        },
      );
      const submission = json.submission as PublicSubmission;
      setAnswers({ ...seedDefaultAnswers(submission.form), ...(submission.answers || {}) });
      setFiles(submission.files || []);
      if (showNotice) setNotice('Progress saved securely.');
      return true;
    } catch (err) {
      if ((err as ApiError)?.code === 'form_validation_failed') applyServerIssues((err as ApiError).detail);
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    if (!currentPage) return;
    const saved = await saveProgress(false);
    if (!saved) return;
    const updatedPages = form ? publicPageSequence(form, answers) : pages;
    const index = updatedPages.findIndex((page) => page.key === currentPage.key);
    const next = updatedPages[index + 1];
    if (next) {
      setPageKey(next.key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goBack() {
    if (currentIndex <= 0) return;
    setPageKey(pages[currentIndex - 1].key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyResumeLink() {
    if (!session?.allowSaveResume) return;
    const url = `${window.location.origin}${window.location.pathname}#submission=${encodeURIComponent(session.submissionId)}&token=${encodeURIComponent(session.token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Secure resume link copied. Anyone with this link can access this draft, so keep it private.');
    } catch {
      setNotice('Your progress is saved on this device. Browser clipboard access was unavailable.');
    }
  }

  async function submitForm() {
    if (!session || !form) return;
    setBusy(true);
    setError('');
    setNotice('');
    setFieldIssues({});
    try {
      await apiJson(
        `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}/submit`,
        {
          method: 'POST',
          headers: tokenHeaders(session),
          body: JSON.stringify({ answers, __website: honeypot }),
        },
      );
      clearStoredSession(slug);
      setSubmitted(true);
      setSession(null);
      window.history.replaceState({}, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if ((err as ApiError)?.code === 'form_validation_failed') {
        applyServerIssues((err as ApiError).detail);
        setError('Please review the highlighted fields before submitting.');
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(field: PublicFormField, file: File) {
    if (!session) return;
    setUploadingField(field.key);
    setError('');
    setNotice('');
    let fileId = '';

    try {
      const checksumSha256 = await sha256Hex(file);
      const json = await apiJson(
        `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}/files/presign`,
        {
          method: 'POST',
          headers: tokenHeaders(session),
          body: JSON.stringify({
            fieldKey: field.key,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            checksumSha256,
          }),
        },
      );
      fileId = String(json.fileId || '');
      const uploadResponse = await fetch(String(json.uploadUrl), {
        method: 'PUT',
        body: file,
        headers: json.headers || {},
      });
      if (!uploadResponse.ok) throw new Error('direct_upload_failed');

      await apiJson(
        `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}/files/${encodeURIComponent(fileId)}/confirm`,
        {
          method: 'POST',
          headers: tokenHeaders(session),
          body: JSON.stringify({}),
        },
      );

      setFiles((current) => [
        ...current.filter((entry) => entry.id !== fileId),
        {
          id: fileId,
          fieldKey: field.key,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          state: 'AVAILABLE',
          availableAt: new Date().toISOString(),
        },
      ]);
      setFieldIssues((current) => {
        const next = { ...current };
        delete next[field.key];
        return next;
      });
      setNotice(`${file.name} uploaded securely.`);
    } catch (err) {
      if (fileId) {
        await apiJson(
          `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}/files/${encodeURIComponent(fileId)}`,
          { method: 'DELETE', headers: tokenHeaders(session) },
        ).catch(() => undefined);
      }
      setError((err as Error)?.message === 'direct_upload_failed' ? 'The secure file transfer did not complete. Please try again.' : errorText(err));
    } finally {
      setUploadingField('');
    }
  }

  async function removeFile(file: PublicSubmissionFile) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await apiJson(
        `/api/forms/public/submissions/${encodeURIComponent(session.submissionId)}/files/${encodeURIComponent(file.id)}`,
        { method: 'DELETE', headers: tokenHeaders(session) },
      );
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
      setNotice(`${file.fileName} removed.`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function renderStructuredField(field: PublicFormField, value: unknown, onChange: (value: unknown) => void) {
    if (field.type === 'ADDRESS') {
      const address = isRecord(value) ? value : {};
      const setAddress = (key: string, nextValue: string) => onChange({ ...address, [key]: nextValue });
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="rounded-xl border border-slate-300 px-3 py-3 sm:col-span-2" value={String(address.line1 || '')} onChange={(event) => setAddress('line1', event.target.value)} placeholder="Address line 1" />
          <input className="rounded-xl border border-slate-300 px-3 py-3 sm:col-span-2" value={String(address.line2 || '')} onChange={(event) => setAddress('line2', event.target.value)} placeholder="Address line 2 (optional)" />
          <input className="rounded-xl border border-slate-300 px-3 py-3" value={String(address.city || '')} onChange={(event) => setAddress('city', event.target.value)} placeholder="City" />
          <input className="rounded-xl border border-slate-300 px-3 py-3" value={String(address.region || '')} onChange={(event) => setAddress('region', event.target.value)} placeholder="Province / region" />
          <input className="rounded-xl border border-slate-300 px-3 py-3" value={String(address.postalCode || '')} onChange={(event) => setAddress('postalCode', event.target.value)} placeholder="Postal code" />
          <input className="rounded-xl border border-slate-300 px-3 py-3" value={String(address.country || '')} onChange={(event) => setAddress('country', event.target.value)} placeholder="Country" />
        </div>
      );
    }

    if (field.type === 'MATRIX') {
      const config = isRecord(field.config) ? field.config : {};
      const rows = axisItems(config.rows);
      const columns = axisItems(config.columns);
      const matrix = isRecord(value) ? value : {};
      if (rows.length && columns.length) {
        return (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr><th className="px-3 py-2">Item</th>{columns.map((column) => <th key={column.key} className="px-3 py-2 text-center">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-800">{row.label}</td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-3 text-center">
                        <input type="radio" name={`${field.key}-${row.key}`} checked={String(matrix[row.key] || '') === column.key} onChange={() => onChange({ ...matrix, [row.key]: column.key })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    if (field.type === 'REPEATER') {
      const items = Array.isArray(value) ? value.map((entry) => String(entry ?? '')) : [];
      return (
        <div className="space-y-2">
          {items.map((entry, index) => (
            <div key={index} className="flex gap-2">
              <input className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3" value={entry} onChange={(event) => { const next = [...items]; next[index] = event.target.value; onChange(next); }} />
              <button type="button" className="rounded-xl border border-slate-300 px-3 text-sm" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
            </div>
          ))}
          <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => onChange([...items, ''])}>Add item</button>
        </div>
      );
    }

    const record = isRecord(value) ? value : {};
    return (
      <textarea
        rows={4}
        className="w-full rounded-xl border border-slate-300 px-3 py-3"
        value={String(record.value || '')}
        onChange={(event) => onChange({ value: event.target.value })}
        placeholder={field.placeholder || 'Enter information'}
      />
    );
  }

  function renderField(field: PublicFormField, value: unknown, onChange: (value: unknown) => void) {
    const label = translated('FIELD', field.key, 'label', field.label);
    const placeholder = translated('FIELD', field.key, 'placeholder', field.placeholder);
    const common = 'w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';

    if (field.type === 'INFORMATION') {
      return <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{translated('FIELD', field.key, 'helpText', field.helpText) || label}</div>;
    }
    if (field.type === 'HIDDEN') return null;
    if (field.type === 'LONG_TEXT') return <textarea rows={5} className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
    if (field.type === 'EMAIL') return <input type="email" autoComplete="email" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
    if (field.type === 'PHONE') return <input type="tel" autoComplete="tel" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
    if (field.type === 'URL') return <input type="url" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || 'https://'} />;
    if (field.type === 'DATE') return <input type="date" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
    if (field.type === 'TIME') return <input type="time" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
    if (field.type === 'DATETIME') return <input type="datetime-local" className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
    if (field.type === 'NUMBER' || field.type === 'CURRENCY') return <input type="number" step="any" className={common} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} placeholder={placeholder} />;
    if (field.type === 'BOOLEAN' || field.type === 'CHECKBOX' || field.type === 'CONSENT') {
      return (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
          <span className="text-sm leading-6 text-slate-700">{field.type === 'CONSENT' ? translated('FIELD', field.key, 'helpText', field.helpText) || label : 'Yes'}</span>
        </label>
      );
    }
    if (['SINGLE_SELECT', 'RADIO'].includes(field.type)) {
      return (
        <div className="grid gap-2">
          {(field.options ?? []).map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input type="radio" name={field.key} checked={String(value ?? '') === option.value} onChange={() => onChange(option.value)} />
              <span className="text-sm text-slate-800">{optionLabel(field, option.value, locale, translations)}</span>
            </label>
          ))}
        </div>
      );
    }
    if (['MULTI_SELECT', 'CHECKBOX_GROUP'].includes(field.type)) {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="grid gap-2">
          {(field.options ?? []).map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((entry) => entry !== option.value))} />
              <span className="text-sm text-slate-800">{optionLabel(field, option.value, locale, translations)}</span>
            </label>
          ))}
        </div>
      );
    }
    if (field.type === 'COUNTRY') {
      const config = isRecord(field.config) ? field.config : {};
      const countries = Array.isArray(config.countryOptions) ? config.countryOptions.map(String).filter(Boolean) : [];
      return countries.length ? (
        <select className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select a country</option>
          {countries.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>
      ) : <input className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || 'Country'} />;
    }
    if (field.type === 'RATING') {
      const config = isRecord(field.config) ? field.config : {};
      const maximum = Math.max(1, Math.min(10, Number(config.maxRating || 5)));
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maximum }, (_, index) => index + 1).map((rating) => (
            <button key={rating} type="button" onClick={() => onChange(rating)} className={`h-11 w-11 rounded-xl border text-sm font-semibold ${Number(value) === rating ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>{rating}</button>
          ))}
        </div>
      );
    }
    if (field.type === 'ADDRESS' || field.type === 'MATRIX' || field.type === 'REPEATER') return renderStructuredField(field, value, onChange);
    return <input className={common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
  }

  function renderFileField(field: PublicFormField) {
    const fieldFiles = files.filter((entry) => entry.fieldKey === field.key && entry.state === 'AVAILABLE');
    const config = isRecord(field.config) ? field.config : {};
    const maxFiles = Math.max(1, Math.min(10, Number(config.maxFiles || 5)));
    const allowed = Array.isArray(config.allowedContentTypes) ? config.allowedContentTypes.map(String).join(',') : undefined;
    return (
      <div className="space-y-3">
        {fieldFiles.map((file) => (
          <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <div className="min-w-0"><div className="truncate font-semibold text-emerald-950">{file.fileName}</div><div className="text-xs text-emerald-800">{formatBytes(file.sizeBytes)}</div></div>
            <button type="button" disabled={busy} onClick={() => void removeFile(file)} className="rounded-lg border border-emerald-300 px-3 py-1.5 font-semibold text-emerald-900">Remove</button>
          </div>
        ))}
        {fieldFiles.length < maxFiles ? (
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-700 hover:border-cyan-500">
            {uploadingField === field.key ? 'Uploading securely…' : 'Choose file'}
            <input type="file" className="sr-only" accept={allowed} disabled={uploadingField === field.key || !session} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void uploadFile(field, file); }} />
          </label>
        ) : null}
        <p className="text-xs leading-5 text-slate-500">Files are transferred directly to private storage using a short-lived upload authorisation and checksum verification.</p>
      </div>
    );
  }

  function renderFieldBlock(field: PublicFormField, value: unknown, onChange: (value: unknown) => void) {
    if (!visible.has(field.key)) return null;
    if (field.type === 'HIDDEN') return null;
    const label = translated('FIELD', field.key, 'label', field.label);
    const helpText = translated('FIELD', field.key, 'helpText', field.helpText);
    const issue = fieldIssues[field.key];
    const requiredNow = required.has(field.key);
    return (
      <div id={`field-${field.key}`} className="scroll-mt-28 space-y-2">
        {field.type !== 'INFORMATION' && field.type !== 'CONSENT' ? (
          <label className="block text-sm font-semibold text-slate-900">{label}{requiredNow ? <span className="ml-1 text-rose-600" aria-hidden="true">*</span> : null}</label>
        ) : null}
        {helpText && field.type !== 'CONSENT' && field.type !== 'INFORMATION' ? <p className="text-sm leading-6 text-slate-600">{helpText}</p> : null}
        {field.type === 'FILE_UPLOAD' ? renderFileField(field) : renderField(field, value, onChange)}
        {issue ? <p className="text-sm font-medium text-rose-700">{issue}</p> : null}
      </div>
    );
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">Loading secure form…</div></main>;
  }

  if (!form) {
    return <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-800"><h1 className="text-2xl font-semibold">Form unavailable</h1><p className="mt-3 text-sm leading-6">{error || 'This form could not be loaded.'}</p></div></main>;
  }

  const branding = isRecord(form.version.branding) ? form.version.branding : {};
  const settings = isRecord(form.version.settings) ? form.version.settings : {};
  const formTitle = translated('FORM', form.key, 'name', form.version.title || form.name);
  const formDescription = translated('FORM', form.key, 'description', form.version.description || form.description);
  const progress = pages.length > 0 && currentIndex >= 0 ? Math.round(((currentIndex + 1) / pages.length) * 100) : 0;

  if (submitted) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
        <section className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{String(settings.successTitle || 'Submission received')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">{String(settings.successMessage || 'Thank you. Your form has been submitted securely.')}</p>
        </section>
      </main>
    );
  }

  if (form.version.availability !== 'OPEN') {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight">{formTitle}</h1>
          <p className="mt-3 text-sm leading-6">{form.version.availability === 'NOT_STARTED' ? 'This form is published but its submission window has not opened yet.' : 'This form is no longer accepting submissions.'}</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-6 py-8 text-white sm:px-10">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Secure Ambulant+ form</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{formTitle}</h1>
            {formDescription ? <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{formDescription}</p> : null}
          </div>
          <div className="space-y-6 p-6 sm:p-10">
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
            {notice ? <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">{notice}</div> : null}
            {locales.length > 1 ? (
              <label className="grid max-w-xs gap-2 text-sm font-semibold text-slate-800">Language
                <select className="rounded-xl border border-slate-300 px-3 py-3 font-normal" value={locale} onChange={(event) => setLocale(event.target.value)}>{locales.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select>
              </label>
            ) : null}
            {settings.privacyNotice ? <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{String(settings.privacyNotice)}</div> : null}
            <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label>
            </div>
            <button type="button" disabled={busy} onClick={() => void startForm()} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Starting securely…' : 'Start form'}</button>
            <p className="text-xs leading-5 text-slate-500">A secure draft is created only when you choose Start. If save/resume is enabled, the continuation credential is kept on this device and never stored by the platform in plaintext.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-950 px-6 py-7 text-white sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Secure form</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{formTitle}</h1>
              {formDescription ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{formDescription}</p> : null}
            </div>
            {form.version.allowSaveResume ? <button type="button" onClick={() => void copyResumeLink()} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-300">Copy private resume link</button> : null}
          </div>
          {settings.showProgress !== false ? <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>Step {Math.max(1, currentIndex + 1)} of {Math.max(1, pages.length)}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div></div> : null}
        </header>

        <div className="space-y-6 p-6 sm:p-10">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">{notice}</div> : null}

          {currentPage ? (
            <div className="space-y-8">
              {settings.showPageTitles !== false ? <div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">{translated('PAGE', currentPage.key, 'title', currentPage.title)}</h2>{currentPage.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{translated('PAGE', currentPage.key, 'description', currentPage.description)}</p> : null}</div> : null}

              {currentPage.sections.map((section) => {
                const sectionFields = section.fields.filter((field) => visible.has(field.key));
                if (!sectionFields.length) return null;
                if (section.repeatable) {
                  const count = repeatCounts[section.key] || 0;
                  const min = Number(section.minRepeats ?? 0);
                  const max = Number(section.maxRepeats ?? 100);
                  return (
                    <section key={section.key} className="space-y-5 rounded-2xl border border-slate-200 p-5 sm:p-6">
                      <div><h3 className="text-lg font-semibold text-slate-950">{translated('SECTION', section.key, 'title', section.title)}</h3>{section.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{translated('SECTION', section.key, 'description', section.description)}</p> : null}</div>
                      {Array.from({ length: count }, (_, index) => (
                        <div key={index} className="space-y-5 rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entry {index + 1}</div>{count > min ? <button type="button" onClick={() => removeRepeat(section, index)} className="text-xs font-semibold text-rose-700">Remove</button> : null}</div>
                          {sectionFields.map((field) => {
                            const values = Array.isArray(answers[field.key]) ? answers[field.key] as unknown[] : [];
                            return <div key={field.key}>{renderFieldBlock(field, values[index], (value) => setRepeatValue(field.key, index, value))}</div>;
                          })}
                        </div>
                      ))}
                      {count < max ? <button type="button" onClick={() => addRepeat(section)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Add another</button> : null}
                    </section>
                  );
                }
                return (
                  <section key={section.key} className="space-y-5 rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <div><h3 className="text-lg font-semibold text-slate-950">{translated('SECTION', section.key, 'title', section.title)}</h3>{section.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{translated('SECTION', section.key, 'description', section.description)}</p> : null}</div>
                    {sectionFields.map((field) => <div key={field.key}>{renderFieldBlock(field, answers[field.key], (value) => setScalar(field.key, value))}</div>)}
                  </section>
                );
              })}
            </div>
          ) : <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">No visible pages remain for the current answers.</div>}

          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button type="button" disabled={busy || currentIndex <= 0} onClick={goBack} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Back</button>
              {form.version.allowSaveResume ? <button type="button" disabled={busy} onClick={() => void saveProgress(true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Save progress</button> : null}
            </div>
            {currentIndex >= 0 && currentIndex < pages.length - 1 ? (
              <button type="button" disabled={busy} onClick={() => void goNext()} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save & continue'}</button>
            ) : (
              <button type="button" disabled={busy || Boolean(uploadingField)} onClick={() => void submitForm()} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Submitting…' : String(form.version.submitLabel || 'Submit')}</button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
