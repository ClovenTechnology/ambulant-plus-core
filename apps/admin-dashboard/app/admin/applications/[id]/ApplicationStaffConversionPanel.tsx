'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, RefreshCw, UserRoundPlus } from 'lucide-react';

export function ApplicationStaffConversionPanel({
  application,
  canConvert,
  onChanged,
}: {
  application: any;
  canConvert: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(application?.applicantEmailNormalized || '');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const eligible = ['SUCCESSFUL', 'OFFERED'].includes(application?.status);
  const conversion = application?.staffConversion || null;

  async function loadWorkspace() {
    if (!canConvert) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/recruitment', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to load recruitment defaults');
      setWorkspace(json);
      const preferred = json.settings?.defaultTemplateId || '';
      if (preferred && !templateId) applyTemplate(preferred, json);
    } catch (err: any) {
      setError(err?.message || 'Unable to load recruitment defaults');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setEmail(application?.applicantEmailNormalized || '');
  }, [application?.applicantEmailNormalized]);

  useEffect(() => {
    if (eligible && canConvert && !conversion) void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, canConvert, conversion?.id]);

  function applyTemplate(id: string, source = workspace) {
    setTemplateId(id);
    const template = source?.templates?.find((item: any) => item.id === id);
    if (!template) return;
    setDepartmentId(template.defaultDepartmentId || '');
    setDesignationId(template.defaultDesignationId || '');
    setRoleIds(template.defaultRoleIds || []);
  }

  const designations = useMemo(() => {
    const department = workspace?.support?.departments?.find((item: any) => item.id === departmentId);
    return department?.designations || [];
  }, [workspace, departmentId]);

  async function startConversion() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/applications/${encodeURIComponent(application.id)}/staff-conversion`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: templateId || null,
            name: name.trim() || null,
            email: email.trim() || null,
            departmentId: departmentId || null,
            designationId: designationId || null,
            roleIds,
            notes: notes.trim() || null,
          }),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to start Staff onboarding');
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Unable to start Staff onboarding');
    } finally {
      setBusy(false);
    }
  }

  if (!eligible && !conversion) return null;

  return (
    <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5" /><h2 className="text-lg font-semibold">Staff onboarding</h2></div>
          <p className="mt-1 text-sm text-slate-500">Start staff onboarding for a successful applicant and send the required approval request.</p>
        </div>
        {canConvert && !conversion ? <button type="button" onClick={loadWorkspace} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Defaults</button> : null}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {conversion ? (
        <div className={`rounded-2xl border p-4 ${conversion.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-2 font-semibold">{conversion.status === 'ACTIVE' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : null}{conversion.status.replace(/_/g, ' ')}</div>
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            <div>Approval status: <span className="font-medium">{conversion.roleRequest?.status || '—'}</span></div>
            <div>Staff profile: <span className="font-medium">{conversion.staffProfile?.email || 'Pending approval'}</span></div>
            <div>Department: <span className="font-medium">{conversion.roleRequest?.department?.name || '—'}</span></div>
            <div>Designation: <span className="font-medium">{conversion.roleRequest?.designation?.name || '—'}</span></div>
          </div>
          {conversion.status === 'PENDING_APPROVAL' ? <p className="mt-3 text-xs text-slate-600">Staff activation is awaiting the required approval and account setup.</p> : null}
          {conversion.staffProfile?.id ? <Link href={`/admin/staff/${encodeURIComponent(conversion.staffProfile.id)}`} className="mt-3 inline-flex rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Open Staff profile</Link> : null}
        </div>
      ) : canConvert ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-medium">Recruitment template</span><select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className="w-full rounded-xl border px-3 py-2"><option value="">No template</option>{(workspace?.templates || []).filter((item: any) => item.status === 'ACTIVE').map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Staff name</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="Name for Staff directory" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Department</span><select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setDesignationId(''); }} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{(workspace?.support?.departments || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Designation</span><select value={designationId} onChange={(event) => setDesignationId(event.target.value)} className="w-full rounded-xl border px-3 py-2"><option value="">None</option>{designations.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Direct roles</span><select multiple value={roleIds} onChange={(event) => setRoleIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))} className="min-h-24 w-full rounded-xl border px-3 py-2">{(workspace?.support?.roles || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Internal onboarding notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-xl border p-3" /></label>
          <div className="md:col-span-2"><button type="button" onClick={startConversion} disabled={busy || !email.trim() || (!roleIds.length && !designationId)} className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Start staff onboarding</button><p className="mt-2 text-xs text-slate-500">The staff profile will be activated after the required approval and account setup are completed.</p></div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your role can view the successful application but does not include <code>applications.onboarding.manage</code>.</div>
      )}
    </section>
  );
}
