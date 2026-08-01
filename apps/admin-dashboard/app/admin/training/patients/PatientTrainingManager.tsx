'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  title: string;
  startAt?: string;
  startsAt?: string;
  endAt?: string;
  endsAt?: string;
  status: string;
};

type Patient = {
  id?: string;
  patientId?: string;
  name?: string;
  displayName?: string;
  email?: string;
  contactEmail?: string;
  phone?: string;
  hasDevices?: boolean;
  deviceCount?: number;
};

type Assignment = {
  id: string;
  patientId: string;
  name: string;
  email?: string | null;
  status: string;
  iomtRequested: boolean;
  recordingRequested: boolean;
};

function errorText(value: unknown) {
  const raw = String(value || '').split('_').join(' ');
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Request failed';
}

function slotStart(slot: Slot) { return slot.startAt || slot.startsAt || ''; }
function slotEnd(slot: Slot) { return slot.endAt || slot.endsAt || ''; }

export default function PatientTrainingManager({ initialSlotId = '' }: { initialSlotId?: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState(initialSlotId);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [iomtRequested, setIomtRequested] = useState(true);
  const [recordingRequested, setRecordingRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const selectedSlot = useMemo(() => slots.find((slot) => slot.id === slotId) || null, [slots, slotId]);
  const ended = Boolean(selectedSlot && slotEnd(selectedSlot) && Date.parse(slotEnd(selectedSlot)) <= Date.now());
  const activeAssignments = useMemo(() => assignments.filter((item) => item.status !== 'revoked'), [assignments]);

  const loadSlots = useCallback(async () => {
    const response = await fetch('/api/admin/training/slots', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load training programmes');
    const rows = (body?.slots || body?.items || []) as Slot[];
    setSlots(rows);
    setSlotId((current) => current || rows[0]?.id || '');
  }, []);

  const loadAssignments = useCallback(async (id: string) => {
    if (!id) { setAssignments([]); return; }
    const response = await fetch(`/api/admin/training/patients/invite?trainingSlotId=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load invitations');
    setAssignments(body?.assignments || []);
  }, []);

  const searchPatients = useCallback(async () => {
    const response = await fetch(`/api/admin/patients?q=${encodeURIComponent(query)}&page=1&pageSize=50`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Unable to load patients');
    setPatients(body?.items || body?.patients || []);
  }, [query]);

  useEffect(() => { void loadSlots().catch((error) => setNotice({ tone: 'err', text: errorText(error?.message) })); }, [loadSlots]);
  useEffect(() => { void loadAssignments(slotId).catch((error) => setNotice({ tone: 'err', text: errorText(error?.message) })); }, [loadAssignments, slotId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void searchPatients().catch((error) => setNotice({ tone: 'err', text: errorText(error?.message) })), 250);
    return () => window.clearTimeout(timer);
  }, [searchPatients]);

  const assignedIds = useMemo(() => new Set(activeAssignments.map((item) => item.patientId)), [activeAssignments]);

  async function invite() {
    if (!slotId || selected.length === 0) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/training/patients/invite', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trainingSlotId: slotId, patientIds: selected, iomtRequested, recordingRequested }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Invitation failed');
      setSelected([]);
      await loadAssignments(slotId);
      setNotice({ tone: 'ok', text: `${body?.assignments?.length || selected.length} patient invitation(s) issued.` });
    } catch (error: any) {
      setNotice({ tone: 'err', text: errorText(error?.message) });
    } finally { setBusy(false); }
  }

  async function revoke(assignment: Assignment) {
    if (!window.confirm(`Revoke ${assignment.name}'s training invitation?`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/training/patients/revoke', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id, reason: 'revoked_from_training_control_plane' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(body?.error || 'Revoke failed');
      await loadAssignments(slotId);
      setNotice({ tone: 'ok', text: `${assignment.name}'s invitation was revoked.` });
    } catch (error: any) {
      setNotice({ tone: 'err', text: errorText(error?.message) });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        {notice ? <div className={`mb-4 rounded-2xl border p-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{notice.text}</div> : null}
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Training programme</label>
        <select value={slotId} onChange={(event) => { setSlotId(event.target.value); setSelected([]); }} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm">
          {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.title} | {slot.status} | {slotStart(slot) ? new Date(slotStart(slot)).toLocaleString() : 'Unscheduled'}</option>)}
        </select>
        {ended ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This programme has ended. Existing records remain visible, but new invitations are blocked.</div> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-black uppercase tracking-wide text-slate-500">Search patients
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, phone or MRN" className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-normal normal-case tracking-normal" />
          </label>
          <button type="button" onClick={() => void searchPatients()} className="rounded-xl border px-4 py-3 text-sm font-bold">Refresh</button>
        </div>

        <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {patients.map((patient) => {
            const id = String(patient.id || patient.patientId || '');
            const assigned = assignedIds.has(id);
            const checked = selected.includes(id);
            return (
              <label key={id} className={`flex items-center gap-3 rounded-2xl border p-3 ${assigned ? 'bg-slate-50 opacity-70' : 'bg-white hover:border-indigo-300'}`}>
                <input type="checkbox" disabled={assigned || ended} checked={checked} onChange={() => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-950">{patient.displayName || patient.name || 'Patient'}</span>
                  <span className="block truncate text-xs text-slate-500">{patient.email || patient.contactEmail || patient.phone || id}</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500">{assigned ? 'Already invited' : patient.hasDevices || Number(patient.deviceCount) > 0 ? 'IoMT connected' : 'No device recorded'}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={iomtRequested} onChange={(event) => setIomtRequested(event.target.checked)} /><span><strong>Request IoMT sharing</strong><br /><span className="text-xs text-slate-600">The patient still chooses whether to consent. No readings are shared before acceptance.</span></span></label>
          <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={recordingRequested} onChange={(event) => setRecordingRequested(event.target.checked)} /><span><strong>Recording is planned</strong><br /><span className="text-xs text-slate-600">Requires an explicit patient acknowledgement.</span></span></label>
          <button type="button" disabled={busy || ended || selected.length === 0} onClick={() => void invite()} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Invite {selected.length || ''} selected patient{selected.length === 1 ? '' : 's'}</button>
        </div>
      </section>

      <aside className="rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-4">
        <div className="flex items-center justify-between"><h2 className="font-black text-slate-950">Programme invitations</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{activeAssignments.length} active</span></div>
        <div className="mt-4 space-y-3">
          {assignments.length ? assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-2xl border p-3">
              <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black">{assignment.name}</div><div className="text-xs text-slate-500">{assignment.email || assignment.patientId}</div></div><span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase">{assignment.status}</span></div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600"><span>{assignment.iomtRequested ? 'IoMT requested' : 'No IoMT'}</span>{assignment.recordingRequested ? <span>Recording planned</span> : null}</div>
              {assignment.status !== 'revoked' ? <button type="button" disabled={busy} onClick={() => void revoke(assignment)} className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40">Revoke</button> : null}
            </div>
          )) : <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">No patient invitations for this programme.</div>}
        </div>
      </aside>
    </div>
  );
}
