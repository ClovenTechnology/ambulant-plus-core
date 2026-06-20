// apps/clinician-app/app/lobby/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Ctx = {
  appointmentId?: string;
  encounterId?: string;
  visitId?: string;
  patientId?: string;
  patientName?: string;
  clinicianId?: string;
  clinicianName?: string;
  clinicName?: string;
  clinicAddress?: string;
  reason?: string;
  participantId?: string;
  joinToken?: string;
};

function normalizeOrigin(x?: string | null) {
  const v = (x ?? '').trim();
  if (!v) return '';
  return v.replace(/\/+$/, '');
}

function derivePatientOriginFromHere(here: URL) {
  if (here.hostname.startsWith('clinician.')) {
    return here.protocol + '//' + here.hostname.replace(/^clinician\./, 'patient.');
  }

  return here.origin;
}

function buildSfuUrl(origin: string, roomId: string, ctx: Ctx) {
  const base = normalizeOrigin(origin);
  const u = new URL(base + '/sfu/' + encodeURIComponent(roomId));
  const sp = u.searchParams;

  Object.entries(ctx).forEach(([k, v]) => {
    const val = String(v ?? '').trim();
    if (val) sp.set(k, val);
  });

  return u.toString();
}

function makeFallbackLinks(roomId: string, ctx: Ctx, patientParticipantId?: string) {
  if (typeof window === 'undefined') {
    return { clinician: '', patient: '' };
  }

  const here = new URL(window.location.href);

  const clinicianOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) ||
    here.origin;

  const patientOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) ||
    derivePatientOriginFromHere(here);

  return {
    clinician: buildSfuUrl(clinicianOrigin, roomId, ctx),
    patient: buildSfuUrl(patientOrigin, roomId, {
      ...ctx,
      participantId: patientParticipantId || '',
      joinToken: '',
    }),
  };
}

export default function Lobby() {
  const [ready, setReady] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [ctx, setCtx] = useState<Ctx>({});
  const [patientJoinUrl, setPatientJoinUrl] = useState('');
  const [clinicianJoinUrl, setClinicianJoinUrl] = useState('');
  const [patientParticipantId, setPatientParticipantId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sp = new URL(window.location.href).searchParams;

    const nextRoomId =
      sp.get('roomId') ||
      sp.get('room') ||
      sp.get('roomName') ||
      '';

    const nextCtx: Ctx = {
      appointmentId: sp.get('appointmentId') ?? sp.get('appt') ?? undefined,
      encounterId: sp.get('encounterId') ?? undefined,
      visitId: sp.get('visitId') ?? sp.get('televisitId') ?? undefined,
      patientId: sp.get('patientId') ?? undefined,
      patientName: sp.get('patientName') ?? undefined,
      clinicianId: sp.get('clinicianId') ?? undefined,
      clinicianName: sp.get('clinicianName') ?? undefined,
      clinicName: sp.get('clinicName') ?? undefined,
      clinicAddress: sp.get('clinicAddress') ?? undefined,
      reason: sp.get('reason') ?? undefined,
      participantId: sp.get('participantId') ?? undefined,
      joinToken: sp.get('joinToken') ?? sp.get('jt') ?? undefined,
    };

    setRoomId(nextRoomId);
    setCtx(nextCtx);
    setPatientParticipantId(sp.get('patientParticipantId') || '');
    setPatientJoinUrl(sp.get('patientJoinUrl') || '');
    setClinicianJoinUrl(sp.get('clinicianJoinUrl') || '');
    setReady(true);
  }, []);

  const links = useMemo(() => {
    if (!roomId) return { clinician: '', patient: '' };

    const fallback = makeFallbackLinks(roomId, ctx, patientParticipantId);

    return {
      clinician: clinicianJoinUrl || fallback.clinician,
      patient: patientJoinUrl || fallback.patient,
    };
  }, [roomId, ctx, patientJoinUrl, clinicianJoinUrl, patientParticipantId]);

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      alert('Copied.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      alert('Copied.');
    }
  };

  if (!ready) {
    return <main className="p-6 max-w-xl mx-auto">Loading lobby...</main>;
  }

  if (!roomId) {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Clinician Lobby</h1>
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No appointment room was supplied. Open the lobby from Today or Appointments.
        </div>
        <a href="/today" className="inline-flex rounded border px-3 py-2 hover:bg-gray-50">
          Back to Today
        </a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clinician Lobby</h1>
        <p className="text-sm text-gray-600">
          Prepare for the consultation, review patient context, then enter the secure room.
        </p>
      </div>

      <div className="rounded border p-4 space-y-3 bg-white">
        <div className="grid gap-2 text-sm">
          <div><span className="text-gray-500">Room:</span> <span className="font-mono">{roomId}</span></div>
          {ctx.appointmentId && <div><span className="text-gray-500">Appointment:</span> {ctx.appointmentId}</div>}
          {ctx.encounterId && <div><span className="text-gray-500">Encounter:</span> {ctx.encounterId}</div>}
          {ctx.patientName && <div><span className="text-gray-500">Patient:</span> {ctx.patientName}</div>}
          {ctx.reason && <div><span className="text-gray-500">Reason:</span> {ctx.reason}</div>}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={links.clinician}
            className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            Proceed to Consultation Session
          </a>

          {links.patient && (
            <button
              onClick={() => copy(links.patient)}
              className="px-4 py-2 border rounded hover:bg-gray-100"
              type="button"
              title="Copy patient invite link"
            >
              Copy Patient Invite
            </button>
          )}
        </div>
      </div>

      <div className="rounded border p-4 space-y-3 bg-white">
        <div className="font-medium">Secure invite links</div>
        <div className="text-sm text-gray-600">
          Share only with the intended participant. Do not expose links in screenshots or public channels.
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500">Clinician</div>
          <div className="flex gap-2">
            <input readOnly value={links.clinician} className="border rounded px-2 py-1 flex-1 text-xs" />
            <button onClick={() => copy(links.clinician)} className="px-3 py-1 border rounded" type="button">
              Copy
            </button>
          </div>
        </div>

        {links.patient && (
          <div className="space-y-2 pt-2">
            <div className="text-xs text-gray-500">Patient</div>
            <div className="flex gap-2">
              <input readOnly value={links.patient} className="border rounded px-2 py-1 flex-1 text-xs" />
              <button onClick={() => copy(links.patient)} className="px-3 py-1 border rounded" type="button">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
