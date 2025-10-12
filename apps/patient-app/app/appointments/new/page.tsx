'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API, BASE } from '@/src/lib/config';
import { useActiveEncounter } from '@/components/context/ActiveEncounterContext';
import RefundPolicyPanel from '@/components/RefundPolicyPanel';

let toast: ((msg: string, kind?: 'success'|'error'|'info') => void) | null = null;
try { toast = require('@/components/ToastMount').toast as typeof toast; } catch {}

type PostBody = {
  encounterId: string; sessionId: string; caseId: string;
  clinicianId: string; patientId: string; startsAt: string; endsAt: string;
  meta?: { roomId?: string; reason?: string; channel?: 'televisit'|'in_person' };
};

// Log once on cold start
console.log('[NewAppointmentPage:init]', { API, BASE });

export default function NewAppointmentPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { activeEncounter } = useActiveEncounter();

  const encounterId = activeEncounter?.id ?? 'enc-za-001';
  const sessionId   = activeEncounter?.sessionId ?? 'sess-001';
  const caseId      = activeEncounter?.caseId ?? 'case-za-001';
  const patientId   = activeEncounter?.patientId ?? 'pt-za-001';

  const [clinicianId, setClinicianId] = useState('clin-za-001');
  const t0 = useMemo(() => new Date(Date.now() + 15 * 60 * 1000), []);
  const t1 = useMemo(() => new Date(t0.getTime() + 30 * 60 * 1000), [t0]);

  const [startsAt, setStartsAt] = useState<string>(''); const [endsAt, setEndsAt] = useState<string>('');
  const [reason, setReason] = useState<string>('Televisit consult');
  const [roomId, setRoomId] = useState<string>(() => `room-${Math.random().toString(36).slice(2,8)}`);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showPolicy, setShowPolicy] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(false);

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => { setStartsAt(toLocalInput(t0)); setEndsAt(toLocalInput(t1)); }, [t0, t1]);

  useEffect(() => {
    const qClin = sp.get('clinicianId'); if (qClin) setClinicianId(qClin);
    const qReason = sp.get('reason'); if (qReason) setReason(qReason);
    const qRoom = sp.get('roomId'); if (qRoom) setRoomId(qRoom);
    const qStarts = sp.get('starts'); const qEnds = sp.get('ends');
    const parseLocal = (iso: string) => {
      const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => `${n}`.padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    if (qStarts) { const s = parseLocal(qStarts); if (s) setStartsAt(s); }
    if (qEnds) { const e = parseLocal(qEnds); if (e) setEndsAt(e); }
  }, [sp]);

  const submit = async () => {
    if (!agreePolicy) {
      toast?.('Please review and accept the refund policy before booking.', 'error');
      setShowPolicy(true);
      return;
    }
    setSubmitting(true); setErr(null);
    try {
      const startsISO = new Date(startsAt).toISOString();
      const endsISO = new Date(endsAt).toISOString();

      const body: PostBody = {
        encounterId, sessionId, caseId, clinicianId, patientId,
        startsAt: startsISO, endsAt: endsISO,
        meta: { roomId, reason, channel: 'televisit' },
      };

      // Always hit Gateway; BASE is only used for UI fallbacks elsewhere
      const url = `${API}/api/appointments`;
      console.log('[NewAppointmentPage:try]', url);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(()=>'');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const appt = await res.json();

      try {
        await fetch(`${API}/api/events/emit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'appointment_created',
            encounterId, patientId, clinicianId,
            payload: { apptId: appt.id, startsAt: appt.startsAt, endsAt: appt.endsAt, reason },
            targets: { patientId, clinicianId, admin: true },
          }),
        });
      } catch {}

      toast?.('Appointment created', 'success');
      router.replace(`/appointments?created=${encodeURIComponent(appt.id)}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create appointment');
      toast?.('Failed to create appointment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create Appointment</h1>
        <Link href="/appointments" className="text-sm underline">Back</Link>
      </header>

      <div className="bg-white border rounded p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col">
            <span className="text-gray-600">Clinician ID</span>
            <input className="border rounded px-2 py-1" value={clinicianId} onChange={e=>setClinicianId(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Room ID (meta)</span>
            <input className="border rounded px-2 py-1" value={roomId} onChange={e=>setRoomId(e.target.value)} />
          </label>
          <label className="flex flex-col col-span-2">
            <span className="text-gray-600">Reason (meta)</span>
            <input className="border rounded px-2 py-1" value={reason} onChange={e=>setReason(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Starts</span>
            <input type="datetime-local" className="border rounded px-2 py-1" value={startsAt} onChange={e=>setStartsAt(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Ends</span>
            <input type="datetime-local" className="border rounded px-2 py-1" value={endsAt} onChange={e=>setEndsAt(e.target.value)} />
          </label>
        </div>

        {err ? <div className="text-sm text-rose-600">{err}</div> : null}

        <div className="flex items-center gap-2">
          <button onClick={() => setShowPolicy(true)} className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-100">
            View clinician’s refund policy
          </button>
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={agreePolicy} onChange={e=>setAgreePolicy(e.target.checked)} />
            I have read and accept the refund policy
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={submitting || !agreePolicy} className="px-3 py-2 border rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create Appointment'}
          </button>
          <Link href="/clinicians" className="text-sm underline text-gray-600">Browse clinicians</Link>
        </div>
      </div>

      {showPolicy && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-xl p-4 w-[520px] max-w-[95vw]">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Clinician’s Refund Policy</div>
              <button onClick={() => setShowPolicy(false)} className="text-sm underline">Close</button>
            </div>
            <RefundPolicyPanel clinicianId={clinicianId} />
            <div className="mt-3 text-right">
              <button onClick={() => setShowPolicy(false)} className="px-3 py-1 rounded border bg-white">OK</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
