'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, RefreshCw, Save, Settings2, UserRoundPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

const OPPORTUNITY_TYPES = [
  'CAREER_JOB',
  'INTERNSHIP_GRADUATE',
  'ONBOARDING',
  'PARTNERSHIP',
  'FRANCHISE',
  'VENDOR_PROVIDER',
  'RESEARCH_PILOT',
  'CUSTOM',
];

function blankTemplate() {
  return {
    key: '',
    name: '',
    description: '',
    opportunityType: 'CAREER_JOB',
    opportunityTitle: '',
    opportunitySummary: '',
    opportunityDescription: '',
    applicationFormId: '',
    evaluationFormVersionId: '',
    defaultDepartmentId: '',
    defaultDesignationId: '',
    defaultRoleIds: [] as string[],
    status: 'ACTIVE',
  };
}

export default function RecruitmentWorkspacePage() {
  const [payload, setPayload] = useState<any>(null);
  const [draft, setDraft] = useState<any>(blankTemplate());
  const [editingId, setEditingId] = useState('');
  const [settings, setSettings] = useState<any>({
    defaultTemplateId: '',
    onboardingMessage: '',
    requireCredentialBeforeApproval: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hygiene, setHygiene] = useState<any>(null);
  const [hygieneBusy, setHygieneBusy] = useState(false);
  const [hygieneError, setHygieneError] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/recruitment', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to load recruitment workspace');
      setPayload(json);
      setSettings({
        defaultTemplateId: json.settings?.defaultTemplateId || '',
        onboardingMessage: json.settings?.onboardingMessage || '',
        requireCredentialBeforeApproval: json.settings?.requireCredentialBeforeApproval !== false,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load recruitment workspace');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  const designations = useMemo(() => {
    const department = payload?.support?.departments?.find((item: any) => item.id === draft.defaultDepartmentId);
    return department?.designations || [];
  }, [payload, draft.defaultDepartmentId]);

  function editTemplate(item: any) {
    setEditingId(item.id);
    setDraft({
      key: item.key || '',
      name: item.name || '',
      description: item.description || '',
      opportunityType: item.opportunityType || 'CAREER_JOB',
      opportunityTitle: item.opportunityTitle || '',
      opportunitySummary: item.opportunitySummary || '',
      opportunityDescription: item.opportunityDescription || '',
      applicationFormId: item.applicationFormId || '',
      evaluationFormVersionId: item.evaluationFormVersionId || '',
      defaultDepartmentId: item.defaultDepartmentId || '',
      defaultDesignationId: item.defaultDesignationId || '',
      defaultRoleIds: item.defaultRoleIds || [],
      status: item.status || 'ACTIVE',
    });
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        editingId
          ? `/api/admin/recruitment/templates/${encodeURIComponent(editingId)}`
          : '/api/admin/recruitment',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to save recruitment template');
      setEditingId('');
      setDraft(blankTemplate());
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to save recruitment template');
      setBusy(false);
    }
  }

  async function runDataHygieneAudit() {
    setHygieneBusy(true);
    setHygieneError('');
    try {
      const response = await fetch('/api/admin/recruitment/data-hygiene', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        if (json?.error === 'super_admin_required') {
          throw new Error('Production data hygiene review is available to Super Admins only.');
        }
        throw new Error(json?.error || 'Unable to run production data hygiene review');
      }
      setHygiene(json);
    } catch (err: any) {
      setHygieneError(err?.message || 'Unable to run production data hygiene review');
    } finally {
      setHygieneBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/recruitment/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to save recruitment settings');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to save recruitment settings');
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Applications & Opportunities</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Recruitment templates & settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Reusable recruitment defaults for opportunities, application forms, interview evaluations and staff onboarding.</p>
        </div>
        <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Production data hygiene</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Review likely test, demo or placeholder records before taking any cleanup action. This review never deletes records automatically.
            </p>
          </div>
          <button type="button" onClick={runDataHygieneAudit} disabled={hygieneBusy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${hygieneBusy ? 'animate-spin' : ''}`} />
            {hygieneBusy ? 'Reviewing…' : 'Run data hygiene review'}
          </button>
        </div>
        {hygieneError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{hygieneError}</div> : null}
        {hygiene?.candidates ? (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-slate-500">Reviewed {new Date(hygiene.generatedAt).toLocaleString()} · {hygiene.candidates.length} candidate(s)</div>
            {hygiene.candidates.length ? hygiene.candidates.map((candidate: any) => (
              <a key={`${candidate.entityType}:${candidate.id}`} href={candidate.href} className="flex flex-col gap-2 rounded-2xl border p-4 hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{candidate.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{candidate.entityType}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${candidate.classification === 'TEST_LIKELY' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {candidate.classification === 'TEST_LIKELY' ? 'Likely test data' : 'Review required'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{candidate.detail}</div>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {candidate.safeAction === 'DELETE_ALLOWED' ? 'Super Admin deletion eligible' : candidate.safeAction === 'ARCHIVE_ONLY' ? 'Archive only' : 'Review only'}
                </span>
              </a>
            )) : <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">No obvious test or demo records were identified by the current review rules.</div>}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Briefcase className="h-5 w-5" /><h2 className="text-lg font-semibold">Templates</h2></div>
          <div className="mt-4 space-y-3">
            {(payload?.templates || []).map((item: any) => (
              <button key={item.id} type="button" onClick={() => editTemplate(item)} className="w-full rounded-2xl border p-4 text-left hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3"><div className="font-semibold">{item.name}</div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">{String(item.status || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())}</span></div>
                <div className="mt-1 text-xs text-slate-500">{item.key} · {item.opportunityType ? String(item.opportunityType).toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()) : 'Any opportunity type'}</div>
                <div className="mt-2 text-xs text-slate-500">Application: {item.applicationForm?.name || 'Not preset'} · Evaluation: {item.evaluationFormVersion?.form?.name || 'Not preset'}</div>
              </button>
            ))}
            {(payload?.templates || []).length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No recruitment templates yet.</div> : null}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Settings2 className="h-5 w-5" /><h2 className="text-lg font-semibold">Global settings</h2></div>
          <label className="mt-4 block text-sm"><span className="mb-1 block font-medium">Default recruitment template</span><select value={settings.defaultTemplateId} onChange={(event) => setSettings((current: any) => ({ ...current, defaultTemplateId: event.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{(payload?.templates || []).filter((item: any) => item.status !== 'ARCHIVED').map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="mt-4 block text-sm"><span className="mb-1 block font-medium">Applicant onboarding message</span><textarea value={settings.onboardingMessage} onChange={(event) => setSettings((current: any) => ({ ...current, onboardingMessage: event.target.value }))} className="min-h-28 w-full rounded-xl border p-3" placeholder="Message sent when staff onboarding begins" /></label>
          <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={settings.requireCredentialBeforeApproval} onChange={(event) => setSettings((current: any) => ({ ...current, requireCredentialBeforeApproval: event.target.checked }))} className="mt-1" /><span><span className="font-medium">Require Admin account setup before final staff activation</span><span className="mt-1 block text-xs text-slate-500">Staff activation remains subject to the configured approval and account-setup requirements.</span></span></label>
          <button type="button" onClick={saveSettings} disabled={busy || !payload?.permissions?.canManageSettings} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />Save settings</button>
        </div>
      </section>

      <form onSubmit={saveTemplate} className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5" /><h2 className="text-lg font-semibold">{editingId ? 'Edit template' : 'Create template'}</h2></div>{editingId ? <button type="button" onClick={() => { setEditingId(''); setDraft(blankTemplate()); }} className="rounded-xl border px-3 py-2 text-sm">New template</button> : null}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block font-medium">Key</span><input value={draft.key} onChange={(event) => setDraft((current: any) => ({ ...current, key: event.target.value }))} disabled={Boolean(editingId)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="registered-nurse" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Name</span><input value={draft.name} onChange={(event) => setDraft((current: any) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border px-3 py-2" required /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Opportunity type</span><select value={draft.opportunityType} onChange={(event) => setDraft((current: any) => ({ ...current, opportunityType: event.target.value }))} className="w-full rounded-xl border px-3 py-2">{OPPORTUNITY_TYPES.map((item) => <option key={item} value={item}>{item.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}</select></label>
          <label className="text-sm md:col-span-2 xl:col-span-3"><span className="mb-1 block font-medium">Description</span><textarea value={draft.description} onChange={(event) => setDraft((current: any) => ({ ...current, description: event.target.value }))} className="min-h-20 w-full rounded-xl border p-3" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Application form</span><select value={draft.applicationFormId} onChange={(event) => setDraft((current: any) => ({ ...current, applicationFormId: event.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{(payload?.support?.forms || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Interview evaluation form</span><select value={draft.evaluationFormVersionId} onChange={(event) => setDraft((current: any) => ({ ...current, evaluationFormVersionId: event.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{(payload?.support?.evaluationVersions || []).map((item: any) => <option key={item.id} value={item.id}>{item.form.name} · v{item.versionNumber}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Status</span><select value={draft.status} onChange={(event) => setDraft((current: any) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Default department</span><select value={draft.defaultDepartmentId} onChange={(event) => setDraft((current: any) => ({ ...current, defaultDepartmentId: event.target.value, defaultDesignationId: '' }))} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{(payload?.support?.departments || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Default designation</span><select value={draft.defaultDesignationId} onChange={(event) => setDraft((current: any) => ({ ...current, defaultDesignationId: event.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{designations.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Default roles</span><select multiple value={draft.defaultRoleIds} onChange={(event) => setDraft((current: any) => ({ ...current, defaultRoleIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value) }))} className="min-h-24 w-full rounded-xl border px-3 py-2">{(payload?.support?.roles || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Default opportunity title</span><input value={draft.opportunityTitle} onChange={(event) => setDraft((current: any) => ({ ...current, opportunityTitle: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Default summary</span><input value={draft.opportunitySummary} onChange={(event) => setDraft((current: any) => ({ ...current, opportunitySummary: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm md:col-span-2 xl:col-span-3"><span className="mb-1 block font-medium">Default opportunity description</span><textarea value={draft.opportunityDescription} onChange={(event) => setDraft((current: any) => ({ ...current, opportunityDescription: event.target.value }))} className="min-h-28 w-full rounded-xl border p-3" /></label>
        </div>
        <button type="submit" disabled={busy || !payload?.permissions?.canManageTemplates || !draft.name.trim() || (!editingId && !draft.key.trim())} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />{editingId ? 'Update template' : 'Create template'}</button>
      </form>
    </main>
  );
}
