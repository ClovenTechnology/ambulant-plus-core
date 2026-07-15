// apps/clinician-app/app/appointments/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import JoinTelevisitButton from '@/components/JoinTelevisitButton';

type Appt = {
  id: string;
  appointmentId?: string | null;
  encounterId?: string | null;
  caseId?: string | null;
  visitId?: string | null;
  televisitId?: string | null;
  patientId?: string | null;
  subjectPatientId?: string | null;
  hostUserId?: string | null;
  patientName?: string | null;
  patientDisplayName?: string | null;
  patientAvatarUrl?: string | null;
  patientGender?: string | null;
  patientDob?: string | null;
  clinicianId?: string | null;
  clinicianName?: string | null;
  clinicianDisplayName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  reason?: string | null;
  kind?: string | null;
  visitMode?: string | null;
  patientJoinUrl?: string | null;
  clinicianJoinUrl?: string | null;
  patientParticipantId?: string | null;
  clinicianParticipantId?: string | null;
};

type FilterKey =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'in_progress'
  | 'pending_payment'
  | 'completed'
  | 'cancelled';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'pending_payment', label: 'Awaiting payment' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function asList(payload: any): Appt[] {
  const raw =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.appointments)
        ? payload.appointments
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.appointments)
            ? payload.data.appointments
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

  return raw
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;

      const id = String(item.id || item.appointmentId || item.appointment_id || '').trim();
      if (!id) return null;

      return {
        ...item,
        id,
        patientName:
          item.patientName ||
          item.patientDisplayName ||
          item.patient?.displayName ||
          item.patient?.name ||
          item.meta?.patientDisplayName ||
          null,
        patientAvatarUrl:
          item.patientAvatarUrl ||
          item.patient?.photoUrl ||
          item.meta?.patientAvatarUrl ||
          null,
        clinicianName:
          item.clinicianName ||
          item.clinicianDisplayName ||
          item.clinician?.displayName ||
          item.clinician?.name ||
          item.meta?.clinicianDisplayName ||
          null,
        startsAt: item.startsAt || item.start || item.startTime || item.when || null,
        endsAt: item.endsAt || item.end || item.endTime || null,
        roomId: item.roomId || item.roomName || item.meta?.roomId || null,
        patientJoinUrl: item.patientJoinUrl || item.meta?.patientJoinUrl || null,
        clinicianJoinUrl: item.clinicianJoinUrl || item.meta?.clinicianJoinUrl || null,
        patientParticipantId: item.patientParticipantId || item.meta?.patientParticipantId || null,
        clinicianParticipantId: item.clinicianParticipantId || item.meta?.clinicianParticipantId || null,
      } as Appt;
    })
    .filter(Boolean) as Appt[];
}

function normaliseStatus(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function paymentState(a: Appt) {
  return normaliseStatus(a.paymentStatus || a.status);
}

function appointmentStart(a: Appt) {
  return a.startsAt || a.start || null;
}

function appointmentEnd(a: Appt) {
  return a.endsAt || a.end || null;
}

function startMs(a: Appt) {
  const d = new Date(String(appointmentStart(a) || ''));
  const n = d.getTime();
  return Number.isFinite(n) ? n : 0;
}

function isToday(a: Appt) {
  const ms = startMs(a);
  if (!ms) return false;

  const d = new Date(ms);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isUpcoming(a: Appt) {
  const ms = startMs(a);
  return Boolean(ms && ms >= Date.now());
}

function isPast(a: Appt) {
  const ms = startMs(a);
  return Boolean(ms && ms < Date.now());
}

function displayStatus(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return 'Scheduled';

  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClass(value: unknown) {
  const s = normaliseStatus(value);
  const base = 'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold';

  if (['active', 'in_progress', 'in progress', 'in_consult', 'checked_in'].includes(s)) {
    return `${base} border-blue-200 bg-blue-50 text-blue-700`;
  }

  if (['scheduled', 'confirmed', 'booked', 'ready'].includes(s)) {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  }

  if (['pending_payment', 'pending payment', 'pending'].includes(s)) {
    return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  }

  if (['completed', 'complete', 'done', 'closed'].includes(s)) {
    return `${base} border-slate-200 bg-slate-50 text-slate-700`;
  }

  if (['cancelled', 'canceled'].includes(s)) {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }

  return `${base} border-slate-200 bg-white text-slate-700`;
}

function money(cents?: number | null, currency = 'ZAR') {
  const n = Number(cents || 0);

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency || 'ZAR',
  }).format(n / 100);
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '-';

  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;

  return d.toLocaleString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(value: string | null | undefined) {
  if (!value) return '-';

  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || 'P';
  const second = parts[1]?.[0] || '';

  return (first + second).toUpperCase();
}

function roomIdOf(a: Appt) {
  return a.roomId || a.roomName || '';
}

function patientLabel(a: Appt) {
  return (
    a.patientName ||
    a.patientDisplayName ||
    a.subjectPatientId ||
    a.patientId ||
    'Patient'
  );
}

function reasonLabel(a: Appt) {
  return a.reason || a.kind || 'New consultation';
}

function compactId(value?: string | null) {
  const v = String(value || '').trim();
  if (!v) return '-';
  if (v.length <= 18) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

function lobbyHref(a: Appt) {
  const roomId = roomIdOf(a) || `room-${a.id}`;
  const sp = new URLSearchParams();

  sp.set('roomId', roomId);
  sp.set('appointmentId', a.id);

  if (a.encounterId) sp.set('encounterId', a.encounterId);
  if (a.caseId) sp.set('caseId', a.caseId);
  if (a.visitId || a.televisitId) sp.set('visitId', String(a.visitId || a.televisitId));
  if (a.patientId) sp.set('patientId', a.patientId);
  if (a.subjectPatientId) sp.set('subjectPatientId', a.subjectPatientId);
  if (a.patientName || a.patientDisplayName) sp.set('patientName', patientLabel(a));
  if (a.clinicianId) sp.set('clinicianId', a.clinicianId);
  if (a.clinicianName || a.clinicianDisplayName) sp.set('clinicianName', String(a.clinicianName || a.clinicianDisplayName));
  if (a.patientParticipantId) sp.set('patientParticipantId', a.patientParticipantId);
  if (a.clinicianParticipantId) sp.set('participantId', a.clinicianParticipantId);
  if (a.patientJoinUrl) sp.set('patientJoinUrl', a.patientJoinUrl);
  if (a.clinicianJoinUrl) sp.set('clinicianJoinUrl', a.clinicianJoinUrl);

  return '/lobby?' + sp.toString();
}

function joinHref(a: Appt) {
  return a.clinicianJoinUrl || lobbyHref(a);
}

async function resolveClinicianId(): Promise<string> {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('clinicianId') || '';
    if (fromUrl) return fromUrl;
  }

  try {
    const r = await fetch('/api/me', { cache: 'no-store' });
    if (!r.ok) return '';

    const me = await r.json();

    return (
      me?.clinicianId ||
      me?.clinician?.id ||
      me?.user?.clinicianId ||
      me?.user?.clinician?.id ||
      me?.id ||
      ''
    );
  } catch {
    return '';
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function EmptyState({ busy }: { busy: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
      <div className="text-lg font-semibold text-slate-900">
        {busy ? 'Loading appointments…' : 'No matching appointments'}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Booked consultations will appear here with patient details, payment state, room links, and clinical workflow actions.
      </p>
    </div>
  );
}

export default function ClinicianAppointmentsPage() {
  const [items, setItems] = useState<Appt[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('');

  async function load() {
    setErr('');
    setBusy(true);

    try {
      const clinicianId = await resolveClinicianId();

      if (!clinicianId) {
        setItems([]);
        setErr('Clinician context could not be resolved. Please sign in again.');
        return;
      }

      const params = new URLSearchParams();
      params.set('clinicianId', clinicianId);
      params.set('excludeSimulation', '1');

      const r = await fetch('/api/appointments?' + params.toString(), {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.error || 'HTTP ' + r.status);
      }

      setItems(asList(data));
      setLastLoadedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setItems([]);
      setErr(
        e?.message
          ? 'Appointments could not be loaded: ' + e.message
          : 'Appointments could not be loaded.',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();

    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const inProgress = items.filter((a) =>
      ['active', 'in_progress', 'in progress', 'in_consult', 'checked_in'].includes(normaliseStatus(a.status)),
    ).length;

    const awaitingPayment = items.filter((a) =>
      ['pending_payment', 'pending payment', 'pending'].includes(paymentState(a)),
    ).length;

    const completed = items.filter((a) =>
      ['completed', 'complete', 'done', 'closed'].includes(normaliseStatus(a.status)),
    ).length;

    return {
      today: items.filter(isToday).length,
      upcoming: items.filter(isUpcoming).length,
      inProgress,
      awaitingPayment,
      completed,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return items
      .filter((a) => {
        const s = normaliseStatus(a.status);
        const p = paymentState(a);

        if (filter === 'today' && !isToday(a)) return false;
        if (filter === 'upcoming' && !isUpcoming(a)) return false;
        if (filter === 'in_progress' && !['active', 'in_progress', 'in progress', 'in_consult', 'checked_in'].includes(s)) return false;
        if (filter === 'pending_payment' && !['pending_payment', 'pending payment', 'pending'].includes(p)) return false;
        if (filter === 'completed' && !['completed', 'complete', 'done', 'closed'].includes(s)) return false;
        if (filter === 'cancelled' && !['cancelled', 'canceled'].includes(s)) return false;

        if (!term) return true;

        const haystack = [
          a.id,
          a.encounterId,
          a.caseId,
          a.patientId,
          a.subjectPatientId,
          a.patientName,
          a.patientDisplayName,
          a.status,
          a.paymentStatus,
          a.reason,
          a.roomId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => {
        const aMs = startMs(a);
        const bMs = startMs(b);

        if (isUpcoming(a) && isUpcoming(b)) return aMs - bMs;
        return bMs - aMs;
      });
  }, [filter, items, q]);

  async function copyPatientInvite(a: Appt) {
    const value = a.patientJoinUrl || '';

    if (!value) {
      window.alert('No patient invite link is available for this appointment yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy patient invite link:', value);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Clinician console
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Appointments
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage booked consultations, payment state, room readiness, patient context, and televisit entry from one clinical operations view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>

          <a
            href="/patients"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Create appointment
          </a>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Today" value={stats.today} hint="scheduled for today" />
        <StatCard label="Upcoming" value={stats.upcoming} hint="future visits" />
        <StatCard label="In progress" value={stats.inProgress} hint="active rooms" />
        <StatCard label="Awaiting payment" value={stats.awaitingPayment} hint="payment pending" />
        <StatCard label="Completed" value={stats.completed} hint="closed visits" />
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={
                  filter === item.key
                    ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-full border bg-white px-4 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 xl:w-80"
              placeholder="Search patient, status, room, encounter..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="whitespace-nowrap text-xs text-slate-400">
              {filtered.length} shown
              {lastLoadedAt ? ` · updated ${lastLoadedAt}` : ''}
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {err}
        </div>
      )}

      {!filtered.length ? (
        <EmptyState busy={busy} />
      ) : (
        <section className="space-y-4">
          {filtered.map((a) => {
            const patient = patientLabel(a);
            const start = appointmentStart(a);
            const end = appointmentEnd(a);
            const roomId = roomIdOf(a);
            const status = a.status || 'scheduled';
            const payment = a.paymentStatus || '';

            return (
              <article
                key={a.id}
                className="overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {a.patientAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.patientAvatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-semibold text-slate-600">
                          {initials(patient)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-slate-950">
                          {patient}
                        </h2>

                        <span className={statusClass(status)}>
                          {displayStatus(status)}
                        </span>

                        {payment && (
                          <span className={statusClass(payment)}>
                            {displayStatus(payment)}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {reasonLabel(a)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {fmtDateTime(start)} - {fmtTime(end)}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {a.visitMode || 'TELEVISIT'}
                        </span>

                        {isPast(a) && (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Past visit
                          </span>
                        )}

                        {roomId && (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Room ready
                          </span>
                        )}
                      </div>

                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900">
                          Technical details
                        </summary>

                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="font-medium text-slate-700">Appointment</span>
                            <br />
                            {compactId(a.id)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Encounter</span>
                            <br />
                            {compactId(a.encounterId)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Patient ID</span>
                            <br />
                            {compactId(a.subjectPatientId || a.patientId)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Room</span>
                            <br />
                            {compactId(roomId)}
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 xl:items-end">
                    {a.priceCents != null && (
                      <div className="text-right text-sm font-semibold text-slate-900">
                        {money(a.priceCents, a.currency || 'ZAR')}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                      <a
                        href={lobbyHref(a)}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Open lobby
                      </a>
                       <JoinTelevisitButton
                         startISO={appointmentStart(a) || ''}
                         endISO={appointmentEnd(a)}
                         status={a.status}
                         roomId={roomId || undefined}
                         apptId={a.id}
                         hideUntilAvailable
                         query={{
                           appointmentId: a.id,
                           encounterId: a.encounterId || undefined,
                           caseId: a.caseId || undefined,
                           visitId: String(a.visitId || a.televisitId || ''),
                           clinicianId: a.clinicianId || undefined,
                           clinicianName: a.clinicianName || a.clinicianDisplayName || undefined,
                           patientId: String(a.subjectPatientId || a.patientId || ''),
                           patientName: patient,
                           participantId: a.clinicianParticipantId || undefined,
                           patientParticipantId: a.patientParticipantId || undefined,
                         }}
                         className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                       />

                      <button
                        type="button"
                        onClick={() => void copyPatientInvite(a)}
                        className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Copy patient invite
                      </button>

                      <a
                        href={`/appointments/${encodeURIComponent(a.id)}`}
                        className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View details
                      </a>

                      {(a.subjectPatientId || a.patientId) && (
                        <a
                          href={`/patients?patientId=${encodeURIComponent(String(a.subjectPatientId || a.patientId))}`}
                          className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View patient
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
