// apps/clinician-app/src/components/AgendaList.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Appointment } from '@/lib/types';

function getEncounterLabel(a: Appointment) {
  const maybe = a as Appointment & {
    encounterId?: string | null;
    encounter?: { id?: string | null } | null;
    caseId?: string | null;
    appointmentId?: string | null;
  };

  return (
    maybe.encounterId ||
    maybe.encounter?.id ||
    maybe.caseId ||
    maybe.appointmentId ||
    'N/A'
  );
}

function buildLobbyHref(a: Appointment) {
  const anyA = a as any;
  const roomId = anyA.roomId || anyA.roomName || ('room-' + a.id);
  const sp = new URLSearchParams();

  sp.set('roomId', roomId);
  sp.set('appointmentId', a.id);

  const encounterId = anyA.encounterId || anyA.encounter?.id || '';
  if (encounterId) sp.set('encounterId', encounterId);

  const visitId = anyA.visitId || anyA.televisitId || '';
  if (visitId) sp.set('visitId', visitId);

  const clinicianId = anyA.clinician?.id || anyA.clinicianId || '';
  if (clinicianId) sp.set('clinicianId', clinicianId);

  const clinicianName = anyA.clinician?.name || anyA.clinicianName || '';
  if (clinicianName) sp.set('clinicianName', clinicianName);

  const patientId = anyA.patient?.id || anyA.patientId || '';
  if (patientId) sp.set('patientId', patientId);

  const patientName = anyA.patient?.name || anyA.patientName || '';
  if (patientName) sp.set('patientName', patientName);

  const participantId = anyA.clinicianParticipantId || (clinicianId ? 'clin-' + clinicianId : '');
  if (participantId) sp.set('participantId', participantId);

  if (anyA.patientParticipantId) sp.set('patientParticipantId', anyA.patientParticipantId);
  if (anyA.patientJoinUrl) sp.set('patientJoinUrl', anyA.patientJoinUrl);
  if (anyA.clinicianJoinUrl) sp.set('clinicianJoinUrl', anyA.clinicianJoinUrl);

  return '/lobby?' + sp.toString();
}

function normaliseStatus(status: unknown) {
  const s = String(status || '').toLowerCase();
  if (s.includes('confirm')) return 'confirmed';
  if (s.includes('check')) return 'checked_in';
  if (s.includes('progress') || s.includes('active')) return 'in_consult';
  if (s.includes('no_show')) return 'no_show';
  if (s.includes('cancel')) return 'cancelled';
  return s || 'scheduled';
}

export default function AgendaList({
  clinicianId,
  selectedId,
  onSelect,
}: {
  clinicianId: string;
  selectedId: string | null;
  onSelect: (a: Appointment) => void;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    if (!clinicianId) {
      setAppointments([]);
      setBusy(false);
      return;
    }

    setErr('');

    try {
      const params = new URLSearchParams({ clinicianId });
      const res = await fetch('/api/appointments/today?' + params.toString(), {
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'appointments_today_failed');
      }

      const list = Array.isArray(data?.appointments)
        ? data.appointments
        : Array.isArray(data?.items)
          ? data.items
          : [];

      setAppointments(list as Appointment[]);
    } catch (e: any) {
      setAppointments([]);
      setErr(e?.message || 'Could not load appointments.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId]);

  const count = appointments.length;

  if (busy) {
    return <div className="p-4 text-gray-500">Loading today's appointments...</div>;
  }

  if (err) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
        {err}
      </div>
    );
  }

  if (!appointments.length) {
    return <div className="p-4 text-gray-500">No appointments today.</div>;
  }

  return (
    <section className="rounded-xl border bg-white/60 backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-medium">Agenda</h2>
        <div className="flex-1" />
        <button
          type="button"
          onClick={load}
          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
        >
          Refresh
        </button>
        <div className="text-sm text-gray-600">{count} today</div>
      </div>

      <ul className="space-y-2">
        {appointments.map((a) => {
          const anyA = a as any;
          const active = selectedId === a.id;
          const status = normaliseStatus(anyA.status);

          const statusColor =
            status === 'checked_in'
              ? 'bg-green-500'
              : status === 'in_consult'
                ? 'bg-indigo-500'
                : status === 'no_show' || status === 'cancelled'
                  ? 'bg-red-500'
                  : status === 'confirmed'
                    ? 'bg-blue-500'
                    : 'bg-amber-500';

          return (
            <li
              key={a.id}
              onClick={() => onSelect(a)}
              className={
                'cursor-pointer rounded-lg border p-3 transition ' +
                (active ? 'border-indigo-500 bg-indigo-50' : 'bg-white hover:bg-gray-50')
              }
            >
              <div className="flex items-start gap-3">
                <div className={'mt-1 h-2.5 w-2.5 rounded-full ' + statusColor} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium truncate">
                      {anyA.patient?.name || anyA.patientName || 'Patient'}
                    </div>

                    <span className="text-xs rounded-full border px-2 py-0.5 text-gray-600">
                      {status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {new Date(anyA.start || anyA.startsAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {new Date(anyA.end || anyA.endsAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="text-xs text-gray-500">
                    Encounter: {getEncounterLabel(a)}
                  </div>

                  <div className="text-xs text-gray-500">
                    Room: {anyA.roomId || anyA.roomName || '-'}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildLobbyHref(a));
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
                  >
                    Open lobby
                  </button>

                  {anyA.patient?.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/patients/' + encodeURIComponent(anyA.patient.id));
                      }}
                      className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"
                    >
                      View patient
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
