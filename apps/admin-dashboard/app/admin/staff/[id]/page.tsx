'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarPlus, MessageSquare, Phone, RefreshCw, Video } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Payload = { ok: boolean; item: any; security?: any; audit?: any[]; permissions?: any; error?: string };

function Field({ label, value }: { label: string; value: any }) {
  return <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-sm text-slate-800">{value || '—'}</div></div>;
}

function Action({ icon: Icon, children, href, title }: { icon: any; children: React.ReactNode; href?: string; title?: string }) {
  if (href) {
    return <Link href={href} title={title} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Icon className="h-4 w-4" />{children}</Link>;
  }

  return <button type="button" disabled title={title || "Enabled in the next coordinated communications batch"} className="inline-flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-400 opacity-70"><Icon className="h-4 w-4" />{children}</button>;
}

export default function AdminStaffProfilePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Record<string, any>>({});
  const [reason, setReason] = useState('');

  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(params.id)}`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to load staff profile');
      setData(json);
      if (json.item?.kind === 'staff') setEdit({ phone: json.item.phone || '', staffIdentifier: json.item.staffIdentifier || '', timezone: json.item.timezone || '', preferredContactMethod: json.item.preferredContactMethod || '' });
    } catch (err: any) { setError(err?.message || 'Unable to load staff profile'); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  async function saveProfile() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(params.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edit) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to save staff profile');
      await load();
    } catch (err: any) { setError(err?.message || 'Unable to save staff profile'); setBusy(false); }
  }

  async function lifecycle(state: string) {
    if ((state === 'SUSPENDED' || state === 'ARCHIVED') && !reason.trim()) { setError('A reason is required for suspension or archive.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(params.id)}/lifecycle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, reason: reason.trim() || null }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to change lifecycle');
      setReason(''); await load();
    } catch (err: any) { setError(err?.message || 'Unable to change lifecycle'); setBusy(false); }
  }

  const item = data?.item;
  const pending = item?.kind === 'pending';
  const canManage = Boolean(data?.permissions?.canManage) && !pending;

  return <main className="space-y-6 p-4 lg:p-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><Link href="/admin/staff" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Staff directory</Link><div className="mt-3 flex items-center gap-3">{item?.photoUrl ? <img src={item.photoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600 ring-1 ring-slate-200">{String(item?.name || item?.email || '?').trim().slice(0, 1).toUpperCase()}</div>}<div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">{item?.name || 'Staff profile'}</h1><p className="mt-1 text-sm text-slate-500">{item?.email || ''}</p></div></div></div>
      <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
    </header>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {item && <>
      <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{item.lifecycleState}</div><div className="mt-2 text-lg font-semibold">{item.department?.name || 'No department'} · {item.designation?.name || 'No designation'}</div></div><div className="flex flex-wrap gap-2"><Action icon={MessageSquare}>Message</Action><Action icon={Phone}>Audio call</Action><Action icon={Video}>Video call</Action><Action icon={CalendarPlus} href={!pending && data?.permissions?.canCreateMeetings ? `/admin/meetings/new?staffId=${encodeURIComponent(item.id)}` : undefined} title={data?.permissions?.canCreateMeetings ? 'Schedule a meeting with this staff member' : 'meetings.create permission required'}>Schedule meeting</Action></div></div><p className="mt-3 text-xs text-slate-500">Meeting scheduling is now backed by the shared meeting authority. Persistent messaging and direct-call room UX are delivered in the next coordinated Sprint C batch.</p></section>
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2"><h2 className="text-lg font-semibold">Identity & organisation</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="Email" value={item.email} /><Field label="Mobile" value={item.phone} /><Field label="Staff identifier" value={item.staffIdentifier} /><Field label="Department" value={item.department?.name} /><Field label="Designation" value={item.designation?.name} /><Field label="Manager" value={item.manager?.name} /><Field label="Presence" value={item.presence} /><Field label="Timezone" value={item.timezone} /><Field label="Preferred contact" value={item.preferredContactMethod} /><Field label="Working hours" value={item.workingHours ? JSON.stringify(item.workingHours) : null} /><Field label="Last activity" value={item.lastActivityAt ? new Date(item.lastActivityAt).toLocaleString() : null} /></div><div className="mt-6"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Roles</div><div className="mt-2 flex flex-wrap gap-2">{(item.roles || []).map((role: any) => <span key={role.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{role.name}</span>)}</div></div><div className="mt-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scopes</div><div className="mt-2 flex flex-wrap gap-2">{(item.scopes || item.roles?.flatMap((r: any) => r.scopes) || []).map((scope: string) => <span key={scope} className="rounded-full border px-2 py-1 text-[11px] text-slate-600">{scope}</span>)}</div></div></div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Security & reporting</h2><div className="mt-5 space-y-4"><Field label="Credential" value={data?.security?.credentialPresent === true ? 'Present' : pending ? 'Pending approval' : 'Not recorded'} /><Field label="Last login" value={data?.security?.lastLoginAt ? new Date(data.security.lastLoginAt).toLocaleString() : null} /><Field label="Direct reports" value={(item.directReports || []).length ? item.directReports.map((x: any) => x.name).join(', ') : null} /></div></div>
      </section>
      {canManage && <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Staff administration</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input value={edit.phone || ''} onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))} placeholder="Mobile number" className="rounded-xl border px-3 py-2 text-sm" /><input value={edit.staffIdentifier || ''} onChange={(e) => setEdit((x) => ({ ...x, staffIdentifier: e.target.value }))} placeholder="Staff identifier" className="rounded-xl border px-3 py-2 text-sm" /><input value={edit.timezone || ''} onChange={(e) => setEdit((x) => ({ ...x, timezone: e.target.value }))} placeholder="Timezone" className="rounded-xl border px-3 py-2 text-sm" /><select value={edit.preferredContactMethod || ''} onChange={(e) => setEdit((x) => ({ ...x, preferredContactMethod: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm"><option value="">Preferred contact</option><option value="IN_APP">In app</option><option value="EMAIL">Email</option><option value="MOBILE">Mobile</option></select></div><button onClick={saveProfile} disabled={busy} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save profile fields</button><div className="mt-6 border-t pt-5"><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lifecycle reason (required for suspend/archive)" className="min-h-20 w-full rounded-xl border p-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2">{['ACTIVE','LEAVE','SUSPENDED','ARCHIVED'].map((state) => <button key={state} disabled={busy || item.lifecycleState === state} onClick={() => lifecycle(state)} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">Set {state}</button>)}</div></div></section>}
      {(data?.audit || []).length > 0 && <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Audit history</h2><div className="mt-4 divide-y">{data!.audit!.map((entry: any) => <div key={entry.id} className="py-3 text-sm"><div className="font-medium text-slate-800">{entry.action}</div><div className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()} · {entry.actorUserId || 'system'}</div>{entry.description && <div className="mt-1 text-xs text-slate-600">{entry.description}</div>}</div>)}</div></section>}
    </>}
  </main>;
}
