// apps/clinician-app/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Collapse } from '@/components/ui/Collapse';
import CalendarPreview from '@/app/settings/consult/CalendarPreview';
import { useLiveAppointments } from '@/src/hooks/useLiveAppointments';
import {
  Calendar as IconCalendar,
  Activity,
  Users,
  FileText,
  Bell,
  Video,
  Clock,
  AlertCircle,
} from 'lucide-react';

/* ---------- Presentation mode toggle ---------- */
const USE_MOCK = false;

/* ---------- Dynamic form imports (client-only) ---------- */
const AppointmentForm = dynamic(
  () => import('@/components/forms/AppointmentForm'),
  { ssr: false },
);
const OrderForm = dynamic(() => import('@/components/forms/OrderForm'), {
  ssr: false,
});
const NoteForm = dynamic(() => import('@/components/forms/NoteForm'), {
  ssr: false,
});

/* ---------- Types ---------- */
type Appointment = {
  id: string;
  patient?: { name?: string };
  patientName?: string;
  start?: string;
  end?: string;
  when?: string;
  reason?: string;
  status?: 'booked' | 'checked-in' | 'completed' | 'no-show' | 'cancelled' | string;
  priority?: 'Low' | 'Medium' | 'High';
  roomName?: string;
};

type InboxEvent = {
  id: string;
  title: string;
  body?: string;
  timestamp: string;
  type?: 'lab' | 'message' | 'alert' | 'reminder';
};

/* ---------- Helpers ---------- */
function formatTime(iso?: string) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/* ---------- Invite link helpers (queue / waiting room) ---------- */
function makeLinks(roomId: string) {
  if (!roomId) {
    return { clinician: '', patient: '' };
  }

  if (typeof window === 'undefined') {
    return {
      clinician: `http://localhost:3001/sfu/${encodeURIComponent(roomId)}`,
      patient: `http://localhost:3000/sfu/${encodeURIComponent(roomId)}`,
    };
  }

  const here = new URL(window.location.href);
  const clinician = `${here.origin.replace(
    /\/lobby\/?$/,
    '',
  )}/sfu/${encodeURIComponent(roomId)}`;

  const patientURL = new URL(here.href);
  patientURL.port = '3000';
  patientURL.pathname = `/sfu/${encodeURIComponent(roomId)}`;
  patientURL.search = '';
  patientURL.hash = '';
  const patient = patientURL.toString();

  return { clinician, patient };
}

async function copyToClipboard(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
    alert('Copied!');
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      alert('Copied!');
    } catch {
      alert('Could not copy to clipboard');
    }
  }
}

/* ---------- ToggleBtn ---------- */
function ToggleBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className="w-8 h-8 rounded border flex items-center justify-center text-sm font-medium hover:bg-gray-100"
      title={open ? 'Collapse' : 'Expand'}
      type="button"
    >
      {open ? '−' : '+'}
    </button>
  );
}

/* ---------- DayProgress ---------- */
function DayProgress({
  appointments,
  progressMap,
}: {
  appointments: Appointment[];
  progressMap: Record<string, { pct: number; status?: string }>;
}) {
  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === 'completed').length;

  const pctFromStatus = total === 0 ? 0 : Math.round((completed / total) * 100);

  const pctValues = appointments
    .map((a) => progressMap[a.id]?.pct)
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

  const pctFromMap =
    pctValues.length > 0
      ? Math.round(pctValues.reduce((sum, v) => sum + v, 0) / pctValues.length)
      : null;

  const pct = pctFromMap ?? pctFromStatus;

  const starts = appointments
    .map((a) => (a.start ? new Date(a.start).getTime() : NaN))
    .filter(Number.isFinite);
  const ends = appointments
    .map((a) => (a.end ? new Date(a.end).getTime() : NaN))
    .filter(Number.isFinite);
  const first = starts.length
    ? new Date(Math.min(...starts)).toISOString()
    : undefined;
  const last =
    starts.length || ends.length
      ? new Date(Math.max(...starts.concat(ends))).toISOString()
      : undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="w-44">
        <div className="text-xs text-gray-500">Day progress</div>
        <div className="mt-1 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-linear"
            style={{
              width: `${Math.min(100, pct)}%`,
              background:
                pct >= 100
                  ? 'linear-gradient(90deg,#ef4444,#b91c1c)'
                  : '#4f46e5',
            }}
            aria-hidden
          />
        </div>
      </div>
      <div className="text-sm font-medium tabular-nums">{pct}%</div>
      <div className="text-xs text-gray-500 ml-auto">
        <div>
          First:{' '}
          <span className="font-mono text-xs text-gray-700">
            {first ? formatTime(first) : '—'}
          </span>
        </div>
        <div>
          Last:{' '}
          <span className="font-mono text-xs text-gray-700">
            {last ? formatTime(last) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI small components ---------- */
function StatusBadge({ status }: { status?: Appointment['status'] }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    'checked-in': { bg: 'bg-amber-500', text: 'text-white', label: 'Waiting' },
    booked: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Booked' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Done' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
    'no-show': { bg: 'bg-red-100', text: 'text-red-700', label: 'No Show' },
  };
  const conf = config[status ?? 'booked'] ?? config.booked;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${conf.bg} ${conf.text}`}
    >
      {conf.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: Appointment['priority'] }) {
  if (priority === 'High') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded bg-red-500 text-white">
        🔴 High
      </span>
    );
  }
  if (priority === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700">
        Medium
      </span>
    );
  }
  return null;
}

function KPICard({
  icon: Icon,
  label,
  value,
  color = 'indigo',
}: {
  icon: any;
  label: string;
  value: number;
  color?: string;
}) {
  const bgMap: Record<string, string> = {
    indigo: 'bg-indigo-50',
    amber: 'bg-amber-50',
    green: 'bg-green-50',
    blue: 'bg-blue-50',
  };
  const textMap: Record<string, string> = {
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
  };
  return (
    <div className={`${bgMap[color]} rounded-xl p-4 flex items-center gap-3`}>
      <div className={textMap[color]}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}

/* ---------- Small utilities ---------- */
function getProgress(start?: string, end?: string) {
  if (!start || !end) return 0;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const total = e - s;
  if (!Number.isFinite(total) || total === 0) return 0;
  const elapsed = now - s;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function getTimeUntil(start?: string) {
  if (!start) return '—';
  const now = Date.now();
  const s = new Date(start).getTime();
  const diff = s - now;
  if (diff < 0) return 'Now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/* ---------- Time helpers for televisit ---------- */
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function canJoinTelevisitNow(appt?: Appointment | null): boolean {
  if (!appt) return false;
  const startIso = appt.start ?? appt.when;
  if (!startIso) return false;

  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) return false;

  const end = appt.end
    ? new Date(appt.end)
    : new Date(start.getTime() + 30 * 60 * 1000);

  const now = new Date();
  if (!isSameDay(start, now)) return false;

  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();

  const EARLY_JOIN_MS = 10 * 60 * 1000;
  const LATE_JOIN_MS = 10 * 60 * 1000;

  return nowMs >= startMs - EARLY_JOIN_MS && nowMs <= endMs + LATE_JOIN_MS;
}

/* ---------- Mock data (display-only fallback) ---------- */
const MOCK_APPOINTMENTS: Appointment[] = (() => {
  const now = Date.now();
  const toISO = (ms: number) => new Date(ms).toISOString();
  return [
    {
      id: 'appt-1001',
      patientName: 'Mandla Dlamini',
      start: toISO(now - 45 * 60 * 1000),
      end: toISO(now - 15 * 60 * 1000),
      reason: 'Wound review',
      status: 'completed',
      priority: 'Low',
      roomName: 'room-1001',
    } as any,
    {
      id: 'appt-1002',
      patientName: 'Zanele Nkosi',
      start: toISO(now - 5 * 60 * 1000),
      end: toISO(now + 25 * 60 * 1000),
      reason: 'Follow-up: hypertension',
      status: 'checked-in',
      priority: 'High',
      roomName: 'room-1002',
    } as any,
    {
      id: 'appt-1003',
      patientName: 'Lerato Mokoena',
      start: toISO(now + 20 * 60 * 1000),
      end: toISO(now + 50 * 60 * 1000),
      reason: 'Diabetes review',
      status: 'booked',
      priority: 'High',
      roomName: 'room-1003',
    } as any,
    {
      id: 'appt-1004',
      patientName: 'Thabo Mahlangu',
      start: toISO(now + 90 * 60 * 1000),
      end: toISO(now + 120 * 60 * 1000),
      reason: 'New patient consult',
      status: 'booked',
      priority: 'Low',
    } as any,
    {
      id: 'appt-1005',
      patientName: 'Nomsa Khumalo',
      start: toISO(now + 200 * 60 * 1000),
      end: toISO(now + 230 * 60 * 1000),
      reason: 'Contraception',
      status: 'booked',
      priority: 'Low',
    } as any,
  ];
})();

const MOCK_INBOX: InboxEvent[] = [
  {
    id: 'evt-1',
    title: 'Lab result: HbA1c received',
    body: 'Patient Lerato Mokoena — HbA1c 8.1%',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    type: 'lab',
  },
  {
    id: 'evt-2',
    title: 'New message from Dr Le Rooy',
    body: 'Patient Referral: Jess DuPlesis',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    type: 'message',
  },
  {
    id: 'evt-3',
    title: 'Reminder (Priority Patient): Book Lab Review',
    body: 'Today 4pm - roomId: 27u-8u2-6',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    type: 'reminder',
  },
];

/* ---------- Main Page ---------- */
export default function ClinicianDashboardPage() {
  const router = useRouter();

  const [me, setMe] = useState<{
    clinicianId: string;
    name: string;
    status?: string | null;
  } | null>(null);

  const clinicianId = me?.clinicianId ?? 'clin-demo';
  const clinicianName = me?.name ?? 'Nomsa';
  const clinicianStatus = me?.status ?? null;

  const [refreshKey, setRefreshKey] = useState(0);
  const clinicianIdForHook = `${clinicianId}::${refreshKey}`;

  // collapsibles & tabs
  const [activeTab, setActiveTab] =
    useState<'appointments' | 'orders' | 'notes'>('appointments');
  const [teleOpen, setTeleOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [thisWeekOpen, setThisWeekOpen] = useState(false);

  // Selected slot from CalendarPreview
  const [selectedSlot, setSelectedSlot] = useState<{
    start?: string;
    end?: string;
  } | null>(null);

  const [mockAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [mockInbox] = useState<InboxEvent[]>(MOCK_INBOX);

  const [optimisticAppointments, setOptimisticAppointments] = useState<
    Appointment[]
  >([]);

  const {
    appointments: liveAppointmentsHook = [],
    progressMap: liveProgressHook = {},
  } = useLiveAppointments?.(clinicianIdForHook) ?? {
    appointments: [],
    progressMap: {},
  };

  let liveAppointments = [
    ...optimisticAppointments,
    ...(Array.isArray(liveAppointmentsHook) && liveAppointmentsHook.length
      ? liveAppointmentsHook
      : []),
  ];

  if ((!liveAppointments || liveAppointments.length === 0) && !USE_MOCK) {
    console.warn(
      '[ClinicianDashboard] liveAppointments hook returned no data — falling back to mockAppointments for UX',
    );
    liveAppointments = [...optimisticAppointments, ...mockAppointments];
  } else if (USE_MOCK) {
    liveAppointments = [...optimisticAppointments, ...mockAppointments];
  }

  const progressMap =
    liveProgressHook && Object.keys(liveProgressHook).length > 0
      ? (liveProgressHook as Record<string, { pct: number; status?: string }>)
      : {};

  const [inbox, setInbox] = useState<InboxEvent[]>(USE_MOCK ? mockInbox : []);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Inbox loading
  useEffect(() => {
    let cancelled = false;
    if (USE_MOCK) {
      setInbox(mockInbox);
      return;
    }
    (async () => {
      setLoadingInbox(true);
      try {
        const r = await fetch('/api/events/inbox?limit=20', {
          cache: 'no-store',
        });
        if (!r.ok) {
          throw new Error(`Inbox fetch failed ${r.status}`);
        }
        const j = await r.json();
        if (cancelled) return;
        const items: InboxEvent[] = Array.isArray(j) ? j : j?.events || [];
        if (!items || items.length === 0) {
          console.warn(
            '[ClinicianDashboard] inbox API returned empty — using mockInbox fallback',
          );
          setInbox(mockInbox);
        } else {
          setInbox(items);
        }
      } catch (err) {
        console.warn(
          '[ClinicianDashboard] failed to load inbox, falling back to mockInbox',
          err,
        );
        setInbox(mockInbox);
      } finally {
        if (!cancelled) setLoadingInbox(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, mockInbox]);

  // Load clinician from /api/me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) throw new Error(`/api/me returned ${res.status}`);
        const data = await res.json().catch(() => null);
        if (!data || cancelled) return;
        const id =
          data.clinicianId ??
          data.id ??
          data.clinician?.id ??
          data.clinician?.clinicianId ??
          'clin-demo';
        const name =
          data.name ??
          data.displayName ??
          data.clinician?.displayName ??
          data.clinician?.name ??
          'Nomsa';
        const status = data.clinician?.status ?? data.status ?? null;

        setMe({
          clinicianId: String(id),
          name: String(name),
          status: status != null ? String(status) : null,
        });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        console.warn(
          '[ClinicianDashboard] /api/me not available, using demo clinician',
          err,
        );
        if (!cancelled) {
          setMe(
            (prev) =>
              prev ?? {
                clinicianId: 'clin-demo',
                name: 'Nomsa',
                status: 'active',
              },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived / helper functions
  const pickUpcomingAppt = () => {
    if (!liveAppointments || liveAppointments.length === 0) return null;
    const now = Date.now();
    const parsed = liveAppointments
      .map((a) => ({
        ...a,
        _s: a.start ? new Date(a.start).getTime() : NaN,
      }))
      .filter((a) => Number.isFinite(a._s))
      .sort((x, y) => x._s - y._s);
    return parsed.find((a) => a._s >= now) ?? parsed[0] ?? null;
  };

  const routerHandleStartTelevisit = () => {
    const appt = pickUpcomingAppt();
    if (appt) {
      router.push(
        appt.roomName
          ? `/sfu/${encodeURIComponent(appt.roomName)}?appt=${encodeURIComponent(
              appt.id,
            )}`
          : `/televisit/${encodeURIComponent(appt.id)}`,
      );
      return;
    }
    router.push('/sfu/room-1001');
  };

  const handleJoinCall = (appt?: Appointment | null) => {
    if (appt) {
      router.push(
        appt.roomName
          ? `/sfu/${encodeURIComponent(appt.roomName)}?appt=${encodeURIComponent(
              appt.id,
            )}`
          : `/televisit/${encodeURIComponent(appt.id)}`,
      );
    } else {
      routerHandleStartTelevisit();
    }
  };

  const handleTabClick = (t: typeof activeTab) => {
    setActiveTab(t);
    setTabsOpen(true);
  };

  const handleOpenCreateAppointment = () => {
    setActiveTab('appointments');
    setTabsOpen(true);
    const el = document.getElementById('create-appointment-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /* ---------- KPI Metrics ---------- */
  const kpis = {
    patientsToday: liveAppointments.filter((a) => a.status !== 'cancelled')
      .length,
    televisits: liveAppointments.filter((a) => a.status === 'checked-in')
      .length,
    ordersPending: 3,
    labPending: inbox.filter((i) => i.type === 'lab' || i.type === 'alert')
      .length,
  };

  // keyboard shortcuts (C to create, T to join current checked-in)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key.toLowerCase() === 'c') {
        setActiveTab('appointments');
        setTabsOpen(true);
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 't') {
        const joinable = liveAppointments.find(
          (a) => a.status === 'checked-in' && canJoinTelevisitNow(a),
        );
        if (joinable) {
          handleJoinCall(joinable);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [liveAppointments]);

  function apptIsNow(candidate: any) {
    const ts =
      candidate?.start ??
      candidate?.when ??
      candidate?.startsAt ??
      candidate?.whenISO;
    if (!ts) return false;
    const t = Date.parse(ts);
    if (!Number.isFinite(t)) return false;
    const diff = Math.abs(Date.now() - t);
    return diff <= 5 * 60 * 1000;
  }

  /* ---------- Optimistic creation ---------- */
  async function createAppointmentOptimistic(payload: any) {
    const tempId = `temp-${Date.now()}`;
    const opt: Appointment = {
      id: tempId,
      patientName:
        payload.patientName ??
        payload.patient?.name ??
        payload.patientId ??
        'Patient',
      start:
        payload.start ??
        payload.startsAt ??
        payload.when ??
        new Date().toISOString(),
      end:
        payload.end ??
        payload.endsAt ??
        (payload.start || payload.startsAt
          ? new Date(
              Date.parse(payload.start || payload.startsAt) +
                30 * 60 * 1000,
            ).toISOString()
          : undefined),
      reason: payload.reason ?? 'Booking',
      status: payload.status ?? 'booked',
      priority: payload.priority ?? 'Low',
      roomName:
        payload.roomName ?? `room-temp-${Math.floor(Math.random() * 10000)}`,
    };

    setOptimisticAppointments((prev) => [opt, ...prev]);

    try {
      const res = await fetch('/api/_proxy/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `Server returned ${res.status} ${res.statusText} ${text}`,
        );
      }

      const saved = await res.json().catch(() => null);
      if (saved && (saved.id || saved._id)) {
        const savedId = saved.id ?? saved._id;
        setOptimisticAppointments((prev) =>
          prev.map((a) =>
            a.id === tempId ? { ...a, id: String(savedId), ...saved } : a,
          ),
        );
        setRefreshKey((k) => k + 1);
      } else {
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      setOptimisticAppointments((prev) => prev.filter((a) => a.id !== tempId));
      console.error('[ClinicianDashboard] appointment create failed', err);
      const toast = document.createElement('div');
      toast.className =
        'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = `Failed to create appointment: ${
        String((err as any)?.message || err) ?? ''
      }`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
      setRefreshKey((k) => k + 1);
    }
  }

  // onSaved handler (called by AppointmentForm, OrderForm, NoteForm)
  const handleSaved = (payload?: any) => {
    setRefreshKey((k) => k + 1);

    const apptLike =
      payload &&
      typeof payload === 'object' &&
      (payload.id || payload.patientName || payload.start || payload.startsAt);
    if (!apptLike) return;

    if (USE_MOCK) {
      const newAppt: Appointment = {
        id: payload.id ?? `appt-demo-${Date.now()}`,
        patientName:
          payload.patientName ??
          payload.patient?.name ??
          payload.patientId ??
          'Demo Patient',
        start:
          payload.start ??
          payload.startsAt ??
          payload.when ??
          new Date().toISOString(),
        end:
          payload.end ??
          payload.endsAt ??
          (payload.start || payload.startsAt
            ? new Date(
                Date.parse(payload.start || payload.startsAt) +
                  30 * 60 * 1000,
              ).toISOString()
            : undefined),
        reason: payload.reason ?? 'Demo booking',
        status: payload.status ?? 'booked',
        priority: payload.priority ?? 'Low',
        roomName:
          payload.roomName ?? `room-demo-${Math.floor(Math.random() * 1000)}`,
      };

      setInbox((prev) => [
        {
          id: `evt-${Date.now()}`,
          title: `Appointment created: ${newAppt.patientName}`,
          body: `${newAppt.reason}`,
          timestamp: new Date().toISOString(),
          type: 'reminder',
        },
        ...prev,
      ]);

      if (apptIsNow(newAppt)) {
        setTimeout(() => {
          router.push(`/televisit/${encodeURIComponent(newAppt.id)}`);
        }, 300);
      }
      return;
    }

    // Production path: optimistic create via local proxy
    createAppointmentOptimistic(payload);
  };

  /* ---------- Derived data for UI ---------- */
  const needsAttention = liveAppointments.filter(
    (a) => a.priority === 'High' && a.status !== 'completed',
  );
  const labAlerts = inbox.filter(
    (i) => i.type === 'lab' || i.type === 'alert',
  );

  const queue = liveAppointments.filter((a) => a.status === 'checked-in');
  const checkedInPatient =
    queue.find((appt) => canJoinTelevisitNow(appt)) ?? null;
  const nextCheckedIn =
    !checkedInPatient && queue.length > 0 ? queue[0] : null;

  const upcomingFiltered = liveAppointments
    .filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
    .sort(
      (a, b) =>
        (new Date(a.start ?? '').getTime() || 0) -
        (new Date(b.start ?? '').getTime() || 0),
    )
    .slice(0, 6);

  const completedToday = liveAppointments.filter(
    (a) => a.status === 'completed',
  ).length;
  const totalToday = liveAppointments.filter(
    (a) => a.status !== 'cancelled',
  ).length;

  const nextAppt = pickUpcomingAppt();
  const primaryRoomId =
    queue[0]?.roomName ??
    nextAppt?.roomName ??
    (queue[0]?.id || nextAppt?.id) ??
    'room-1001';
  const queueLinks = makeLinks(primaryRoomId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Hero Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Hi Dr. {clinicianName}
              </h1>
              <p className="text-gray-600 mt-1">
                {totalToday} patients today · {needsAttention.length} need
                attention
              </p>
            </div>
            <div className="flex items-center gap-3">
              {checkedInPatient ? (
                <button
                  onClick={() => handleJoinCall(checkedInPatient)}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-green-700 transition font-semibold text-lg"
                >
                  <Video className="w-5 h-5" />
                  Join{' '}
                  {checkedInPatient.patient?.name ??
                    checkedInPatient.patientName}
                  <kbd className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded">
                    T
                  </kbd>
                </button>
              ) : nextCheckedIn ? (
                <button
                  disabled
                  className="flex items-center gap-2 bg-gray-200 text-gray-600 px-5 py-2.5 rounded-lg cursor-not-allowed"
                >
                  <Video className="w-5 h-5" />
                  Next checked-in:{' '}
                  {nextCheckedIn.patient?.name ?? nextCheckedIn.patientName}{' '}
                  at {formatTime(nextCheckedIn.start)}
                </button>
              ) : (
                <button
                  onClick={() => routerHandleStartTelevisit()}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow hover:bg-indigo-700 transition"
                >
                  <Video className="w-5 h-5" />
                  Start Televisit
                </button>
              )}

              <button
                onClick={handleOpenCreateAppointment}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                <IconCalendar className="w-4 h-4" />
                Create Appointment
                <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">
                  C
                </kbd>
              </button>
            </div>
          </div>

          {clinicianStatus === 'disabled' && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-semibold text-[13px]">
                  Your clinician profile is disabled.
                </div>
                <div className="text-xs mt-0.5">
                  New bookings and visibility to patients may be paused while
                  your account is disabled. Please contact an admin or support
                  for next steps.
                </div>
              </div>
            </div>
          )}

          {clinicianStatus === 'disciplinary' && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-semibold text-[13px]">
                  Your account is under disciplinary review.
                </div>
                <div className="text-xs mt-0.5">
                  Admin are reviewing your recent activity and ratings. You may
                  continue using the dashboard, but some features or visibility
                  could be limited depending on the outcome.
                </div>
              </div>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <KPICard icon={Users} label="Today" value={totalToday} color="indigo" />
            <KPICard
              icon={Clock}
              label="Waiting"
              value={queue.length}
              color="amber"
            />
            <KPICard
              icon={FileText}
              label="Orders"
              value={kpis.ordersPending}
              color="blue"
            />
            <KPICard
              icon={Activity}
              label="Labs"
              value={labAlerts.length}
              color="green"
            />
          </div>

          {/* Day Progress */}
          <div className="mt-4">
            <DayProgress appointments={liveAppointments} progressMap={progressMap} />
            <div className="mt-2 text-sm text-gray-600">
              {completedToday} of {totalToday} completed
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto space-y-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {/* Needs Attention */}
            {needsAttention.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-bold text-red-900">
                    Needs Attention ({needsAttention.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {needsAttention.map((appt) => (
                    <div
                      key={appt.id}
                      className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {appt.patient?.name ?? appt.patientName}
                          </span>
                          <PriorityBadge priority={appt.priority} />
                          <StatusBadge status={appt.status} />
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {appt.reason}
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinCall(appt)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active televisit panel */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Active televisit</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">Live vitals</div>
                  <ToggleBtn
                    open={teleOpen}
                    onClick={() => setTeleOpen((v) => !v)}
                  />
                </div>
              </div>
              <Collapse open={teleOpen}>
                <div className="mt-3">
                  {checkedInPatient ? (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border p-3 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-green-700">
                              PATIENT WAITING
                            </span>
                          </div>
                          <h4 className="text-lg font-bold">
                            {checkedInPatient.patient?.name ??
                              checkedInPatient.patientName}
                          </h4>
                          <div className="text-sm text-gray-600">
                            {checkedInPatient.reason}
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => handleJoinCall(checkedInPatient)}
                            className="px-3 py-1 rounded border text-sm"
                          >
                            Open televisit
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {['HR', 'SpO₂', 'BP', 'Temp'].map((label) => (
                          <div
                            key={label}
                            className="border rounded p-2 text-xs bg-white"
                          >
                            <div className="text-xs text-gray-500">{label}</div>
                            <div className="text-lg font-semibold">
                              {label === 'SpO₂'
                                ? '98 %'
                                : label === 'Temp'
                                ? '36.8 °C'
                                : '72 bpm'}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">
                            Consultation Progress
                          </span>
                          <span className="text-sm font-semibold">
                            {progressMap[checkedInPatient.id]?.pct ??
                              getProgress(
                                checkedInPatient.start,
                                checkedInPatient.end,
                              )}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                progressMap[checkedInPatient.id]?.pct ??
                                getProgress(
                                  checkedInPatient.start,
                                  checkedInPatient.end,
                                )
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border p-3 text-sm text-gray-600">
                      {nextCheckedIn ? (
                        <>
                          No active televisit right now.
                          <br />
                          Next checked-in patient:{' '}
                          <strong>
                            {nextCheckedIn.patient?.name ??
                              nextCheckedIn.patientName}
                          </strong>{' '}
                          at {formatTime(nextCheckedIn.start)}.
                        </>
                      ) : (
                        <>
                          No one is checked in yet. When a patient checks in,
                          they’ll appear here.
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Collapse>
            </section>

            {/* Waiting room / queue */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Waiting room / queue</h3>
                <ToggleBtn
                  open={queueOpen}
                  onClick={() => setQueueOpen((v) => !v)}
                />
              </div>
              <Collapse open={queueOpen}>
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    Patients who have checked in or are about to join your
                    televisit. You can share the invite link with carers /
                    dependants when needed.
                  </p>

                  <div className="rounded border bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        Currently waiting: {queue.length || 0}
                      </span>
                      <span className="text-xs text-gray-500">
                        Room: {primaryRoomId || '—'}
                      </span>
                    </div>

                    {queue.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {queue.map((appt) => {
                          const joinEnabled = canJoinTelevisitNow(appt);
                          return (
                            <li
                              key={appt.id}
                              className="flex items-center justify-between text-xs bg-white rounded px-2 py-1"
                            >
                              <span className="truncate">
                                {appt.patient?.name ??
                                  appt.patientName ??
                                  'Patient'}
                              </span>
                              <span className="flex items-center gap-2">
                                <StatusBadge status={appt.status} />
                                <button
                                  className={`px-2 py-0.5 border rounded text-[11px] ${
                                    joinEnabled
                                      ? 'hover:bg-gray-100'
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  onClick={() =>
                                    joinEnabled && handleJoinCall(appt)
                                  }
                                  disabled={!joinEnabled}
                                >
                                  Join
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-xs text-gray-500">
                        No one in the waiting room yet.
                      </div>
                    )}
                  </div>

                  {primaryRoomId && (
                    <div className="rounded border bg-white p-3 space-y-3">
                      <div className="font-medium text-sm">
                        Invite link (patient)
                      </div>
                      <div className="text-xs text-gray-600">
                        Share this link only with authorised participants for
                        this session (e.g. patient&apos;s carer or dependant).
                      </div>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={queueLinks.patient}
                          className="border rounded px-2 py-1 flex-1 text-xs"
                        />
                        <button
                          onClick={() => copyToClipboard(queueLinks.patient)}
                          className="px-3 py-1 border rounded text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Collapse>
            </section>

            {/* Quick Actions / Inline Tabs */}
            <div
              id="create-appointment-panel"
              className="bg-white rounded-2xl shadow-sm p-3"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex rounded-md bg-gray-100 p-1">
                  <button
                    className={`px-3 py-2 rounded-md text-sm ${
                      activeTab === 'appointments'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-700'
                    }`}
                    onClick={() => handleTabClick('appointments')}
                  >
                    Create Appointment
                  </button>
                  <button
                    className={`px-3 py-2 rounded-md text-sm ${
                      activeTab === 'orders'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-700'
                    }`}
                    onClick={() => handleTabClick('orders')}
                  >
                    New Order
                  </button>
                  <button
                    className={`px-3 py-2 rounded-md text-sm ${
                      activeTab === 'notes'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-700'
                    }`}
                    onClick={() => handleTabClick('notes')}
                  >
                    Create Note
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    Shortcuts:{' '}
                    <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                      C
                    </kbd>{' '}
                    — Create appointment
                  </div>
                  <ToggleBtn
                    open={tabsOpen}
                    onClick={() => setTabsOpen((v) => !v)}
                  />
                </div>
              </div>

              <Collapse open={tabsOpen}>
                <div className="mt-3">
                  {activeTab === 'appointments' && (
                    <AppointmentForm
                      clinicianId={clinicianId}
                      onSaved={handleSaved}
                      prefillStartIso={selectedSlot?.start}
                      prefillEndIso={selectedSlot?.end}
                    />
                  )}
                  {activeTab === 'orders' && (
                    <OrderForm onSaved={handleSaved} />
                  )}
                  {activeTab === 'notes' && <NoteForm onSaved={handleSaved} />}
                </div>
              </Collapse>
            </div>

            {/* Upcoming Schedule */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCalendar className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold">
                    Today&apos;s Upcoming Schedule
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({upcomingFiltered.length})
                  </span>
                </div>
                <ToggleBtn
                  open={scheduleOpen}
                  onClick={() => setScheduleOpen((v) => !v)}
                />
              </div>

              <Collapse open={scheduleOpen}>
                <div className="p-4 space-y-3">
                  {upcomingFiltered.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No upcoming appointments.
                    </div>
                  )}
                  {upcomingFiltered.map((appt) => {
                    const progress =
                      progressMap[appt.id]?.pct ??
                      getProgress(appt.start, appt.end);
                    const isOverdue = progress > 100;
                    const patientName =
                      appt.patient?.name ?? appt.patientName ?? '—';
                    return (
                      <div
                        key={appt.id}
                        className={`p-3 border rounded-lg hover:bg-gray-50 transition ${
                          isOverdue ? 'border-red-300 bg-red-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">
                                {patientName}
                              </span>
                              {appt.priority !== 'Low' && (
                                <PriorityBadge priority={appt.priority} />
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {appt.reason}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-gray-900">
                              {formatTime(appt.start)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getTimeUntil(appt.start)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={appt.status} />
                          {Number.isFinite(progress) && progress > 0 && (
                            <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500"
                                style={{
                                  width: `${Math.min(100, progress)}%`,
                                }}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => handleJoinCall(appt)}
                            className="ml-auto px-3 py-1 text-sm border rounded-lg hover:bg-gray-100 transition"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Collapse>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Inbox / Notifications */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold">Inbox</h3>
                  {labAlerts.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {labAlerts.length}
                    </span>
                  )}
                </div>
                <ToggleBtn
                  open={notifOpen}
                  onClick={() => setNotifOpen((v) => !v)}
                />
              </div>

              <Collapse open={notifOpen}>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {loadingInbox ? (
                    <div className="p-3 text-sm text-gray-500">Loading…</div>
                  ) : inbox.length ? (
                    inbox.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 hover:bg-gray-50 cursor-pointer ${
                          event.type === 'alert' || event.type === 'lab'
                            ? 'bg-amber-50'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {event.type === 'lab' && (
                            <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {event.title}
                            </div>
                            {event.body && (
                              <div className="text-xs text-gray-600 mt-1">
                                {event.body}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {formatTime(event.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500">
                      No notifications.
                    </div>
                  )}
                </div>
              </Collapse>
            </div>

            {/* This Week mini calendar */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">This Week</h3>
                <ToggleBtn
                  open={thisWeekOpen}
                  onClick={() => setThisWeekOpen((v) => !v)}
                />
              </div>

              <Collapse open={thisWeekOpen}>
                <div className="space-y-2">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dayAppts = liveAppointments.filter((a) => {
                      const aDate = a.start ? new Date(a.start) : null;
                      return (
                        aDate && aDate.toDateString() === date.toDateString()
                      );
                    });
                    const isToday = i === 0;
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded-lg border ${
                          isToday
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {date.toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {dayAppts.length} appts
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Collapse>
            </div>

            {/* Availability calendar preview */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Availability</h3>
                <ToggleBtn
                  open={calendarOpen}
                  onClick={() => setCalendarOpen((v) => !v)}
                />
              </div>
              <Collapse open={calendarOpen}>
                <CalendarPreview
                  clinicianId={clinicianId}
                  onSelectSlot={(startIso, endIso) => {
                    setSelectedSlot({ start: startIso, end: endIso });
                    setActiveTab('appointments');
                    setTabsOpen(true);
                    const el = document.getElementById(
                      'create-appointment-panel',
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }
                  }}
                />
              </Collapse>
            </div>

            {/* KPI small tiles */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Patients Today</div>
                  <div className="text-lg font-semibold">
                    {kpis.patientsToday}
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Televisits</div>
                  <div className="text-lg font-semibold">{kpis.televisits}</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Orders Pending</div>
                  <div className="text-lg font-semibold">
                    {kpis.ordersPending}
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Lab Pending</div>
                  <div className="text-lg font-semibold">
                    {kpis.labPending}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
