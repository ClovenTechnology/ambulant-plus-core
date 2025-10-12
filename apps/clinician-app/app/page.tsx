// apps/clinician-app/app/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
import { Collapse } from '@/components/ui/Collapse';
import CalendarPreview from '@/app/settings/consult/CalendarPreview';
import { useLiveAppointments } from '@/src/hooks/useLiveAppointments';

/* ---------- Presentation mode toggle ---------- */
const USE_MOCK = true; // set to false to use real hook/data

/* ---------- Dynamic form imports (client-only) ---------- */
const AppointmentForm = dynamic(() => import('@/components/forms/AppointmentForm'), { ssr: false });
const OrderForm = dynamic(() => import('@/components/forms/OrderForm'), { ssr: false });
const NoteForm = dynamic(() => import('@/components/forms/NoteForm'), { ssr: false });

/* ---------- Types ---------- */
type Appointment = {
  id: string;
  patient?: { name: string };
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
};

/* ---------- Helpers ---------- */
function formatTime(iso?: string) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function StatusPill({ status }: { status?: Appointment['status'] }) {
  const map: Record<string, string> = {
    booked: 'bg-indigo-100 text-indigo-700',
    'checked-in': 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-neutral-100 text-neutral-700',
    'no-show': 'bg-rose-100 text-rose-700',
  };
  return <span className={`inline-flex px-2 py-0.5 text-xs rounded ${map[status ?? 'booked']}`}>{status ?? 'booked'}</span>;
}

/* ---------- DayProgress ---------- */
function DayProgress({ appointments, progressMap }: { appointments: Appointment[]; progressMap: Record<string, { pct: number; status?: string }> }) {
  const total = appointments.length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const starts = appointments.map(a => a.start ? new Date(a.start).getTime() : NaN).filter(Number.isFinite);
  const ends = appointments.map(a => a.end ? new Date(a.end).getTime() : NaN).filter(Number.isFinite);
  const first = starts.length ? new Date(Math.min(...starts)).toISOString() : undefined;
  const last = (starts.length || ends.length) ? new Date(Math.max(...starts.concat(ends))).toISOString() : undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="w-44">
        <div className="text-xs text-gray-500">Day progress</div>
        <div className="mt-1 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-linear"
            style={{
              width: `${Math.min(100, pct)}%`,
              background: pct >= 100 ? 'linear-gradient(90deg,#ef4444,#b91c1c)' : '#4f46e5',
            }}
            aria-hidden
          />
        </div>
      </div>
      <div className="text-sm font-medium tabular-nums">{pct}%</div>
      <div className="text-xs text-gray-500 ml-auto">
        <div>First: <span className="font-mono text-xs text-gray-700">{first ? formatTime(first) : '—'}</span></div>
        <div>Last: <span className="font-mono text-xs text-gray-700">{last ? formatTime(last) : '—'}</span></div>
      </div>
    </div>
  );
}

/* ---------- Mock data (presentation) ---------- */
const MOCK_APPOINTMENTS: Appointment[] = (() => {
  const now = Date.now();
  const toISO = (ms: number) => new Date(ms).toISOString();
  return [
    { id: 'appt-1001', patientName: 'Mandla Dlamini', start: toISO(now - 45 * 60 * 1000), end: toISO(now - 15 * 60 * 1000), reason: 'Wound review', status: 'completed', priority: 'Low', roomName: 'room-1001' },
    { id: 'appt-1002', patientName: 'Zanele Nkosi', start: toISO(now - 5 * 60 * 1000), end: toISO(now + 25 * 60 * 1000), reason: 'Follow-up: hypertension', status: 'checked-in', priority: 'High', roomName: 'room-1002' },
    { id: 'appt-1003', patientName: 'Lerato Mokoena', start: toISO(now + 20 * 60 * 1000), end: toISO(now + 50 * 60 * 1000), reason: 'Diabetes review', status: 'booked', priority: 'Medium', roomName: 'room-1003' },
    { id: 'appt-1004', patientName: 'Thabo Mahlangu', start: toISO(now + 90 * 60 * 1000), end: toISO(now + 120 * 60 * 1000), reason: 'New patient consult', status: 'booked', priority: 'Low' },
    { id: 'appt-1005', patientName: 'Nomsa Khumalo', start: toISO(now + 200 * 60 * 1000), end: toISO(now + 230 * 60 * 1000), reason: 'Contraception', status: 'booked', priority: 'Low' },
  ];
})();

const MOCK_PROGRESS: Record<string, { pct: number; status?: string }> = {
  'appt-1001': { pct: 100, status: 'overrun' },
  'appt-1002': { pct: 60, status: 'ongoing' },
  'appt-1003': { pct: 0, status: 'pre' },
  'appt-1004': { pct: 0, status: 'pre' },
  'appt-1005': { pct: 0, status: 'pre' },
};

const MOCK_INBOX: InboxEvent[] = [
  { id: 'evt-1', title: 'Lab result: HbA1c received', body: 'Patient Lerato Mokoena — HbA1c 8.1%', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'evt-2', title: 'New message from Dr Le Rooy', body: 'Patient Referral: Jess DuPlesis', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: 'evt-3', title: 'Reminder (Priority Patient): Book Lab Review', body: 'Today 4pm - roomId: 27u-8u2-6', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
];

/* ---------- MockCalendarPreview (simple 14-day grid reflecting mock appointments) ---------- */
function MockCalendarPreview({ clinicianId, days = 14, appointments }: { clinicianId?: string; days?: number; appointments: Appointment[] }) {
  // Build days array from today (local)
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const daysArr = Array.from({ length: days }).map((_, i) => {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    return d;
  });

  // group appointments by yyyy-mm-dd
  const map = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const s = a.start ?? a.when ?? '';
    if (!s) return acc;
    const key = new Date(s).toISOString().slice(0, 10); // YYYY-MM-DD
    acc[key] = acc[key] || [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="border rounded p-3 bg-white">
      <div className="text-xs text-gray-500 mb-2">Calendar preview · {days} days</div>
      <div className="grid grid-cols-7 gap-2">
        {daysArr.map(d => {
          const key = d.toISOString().slice(0, 10);
          const items = map[key] || [];
          const today = new Date();
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={key} className={`p-2 border rounded-lg h-28 overflow-hidden ${isToday ? 'ring-2 ring-indigo-200 bg-indigo-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">{d.toLocaleDateString([], { weekday: 'short' })}</div>
                <div className="text-xs text-gray-500">{formatDateShort(d.toISOString())}</div>
              </div>
              <div className="mt-2 text-[12px]">
                {items.length === 0 ? <div className="text-gray-400">No appts</div> : (
                  <ul className="space-y-1 max-h-20 overflow-auto">
                    {items.slice(0, 4).map(it => (
                      <li key={it.id} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{it.patientName}</div>
                          <div className="text-[11px] text-gray-500 truncate">{it.reason}</div>
                        </div>
                        <div className="ml-2 text-xs font-mono">{it.start ? formatTime(it.start) : '—'}</div>
                      </li>
                    ))}
                    {items.length > 4 && <li className="text-xs text-gray-500">+{items.length - 4} more</li>}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function ClinicianDashboardPage() {
  const router = useRouter();
  const clinicianId = 'clin-demo';

  // refreshKey used to force refetch of real hook if not mocking
  const [refreshKey, setRefreshKey] = useState(0);
  const clinicianIdForHook = `${clinicianId}::${refreshKey}`;

  const [activeTab, setActiveTab] = useState<'appointments' | 'orders' | 'notes'>('appointments');
  const [teleOpen, setTeleOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [tabsOpen, setTabsOpen] = useState(true);

  // New collapsible states for Upcoming schedule & Patient queue
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [queueOpen, setQueueOpen] = useState(true);

  // When using mock mode, use local state so user can demo creating items
  const [mockAppointments, setMockAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [mockProgress, setMockProgress] = useState<Record<string, { pct: number; status?: string }>>(MOCK_PROGRESS);
  const [mockInbox, setMockInbox] = useState<InboxEvent[]>(MOCK_INBOX);

  // useLiveAppointments hook (real) — will be ignored in mock mode
  const { appointments: liveAppointmentsHook = [], progressMap: liveProgressHook = {} } = useLiveAppointments?.(clinicianIdForHook) ?? { appointments: [], progressMap: {} };

  // Wire to either mock data or hook data
  const liveAppointments = USE_MOCK ? mockAppointments : liveAppointmentsHook;
  const progressMap = USE_MOCK ? mockProgress : (liveProgressHook as Record<string, { pct: number; status?: string }>);

  const [inbox, setInbox] = useState<InboxEvent[]>(USE_MOCK ? mockInbox : []);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // clinician name wiring with graceful fallback to "Nomsa"
  const [clinicianName, setClinicianName] = useState<string>('Nomsa');

  useEffect(() => {
    if (USE_MOCK) {
      // if mock, populate inbox from mock immediately
      setInbox(mockInbox);
      return;
    }
    (async () => {
      setLoadingInbox(true);
      try {
        const r = await fetch('/api/events/inbox?limit=20', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          setInbox(Array.isArray(j) ? j : (j?.events || []));
        } else setInbox([]);
      } catch {
        setInbox([]);
      } finally {
        setLoadingInbox(false);
      }
    })();
  }, [refreshKey]); // refresh when refreshKey changes

  useEffect(() => {
    // try to resolve clinician/user name from common client storage / globals
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      let name: string | undefined;

      if (win) {
        name = win.__CLINICIAN?.name || win.__USER__?.name || win.__CURRENT_USER__?.name;
        if (!name) {
          const raw = localStorage.getItem('user') || localStorage.getItem('clinician') || sessionStorage.getItem('user') || sessionStorage.getItem('clinician');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              name = parsed?.name || parsed?.fullName || parsed?.displayName;
            } catch {
              // ignore invalid JSON
            }
          }
        }
      }

      if (name && typeof name === 'string' && name.trim().length > 0) setClinicianName(name.trim());
      else setClinicianName('Nomsa');
    } catch {
      setClinicianName('Nomsa');
    }
  }, []);

  const pickUpcomingAppt = () => {
    if (!liveAppointments || liveAppointments.length === 0) return null;
    const now = Date.now();
    const parsed = liveAppointments
      .map(a => ({ ...a, _s: a.start ? new Date(a.start).getTime() : NaN }))
      .filter(a => Number.isFinite(a._s))
      .sort((x, y) => x._s - y._s);
    return parsed.find(a => a._s >= now) ?? parsed[0] ?? null;
  };

  const handleStartTelevisit = () => {
    const appt = pickUpcomingAppt();
    if (appt) {
      router.push(appt.roomName
        ? `/sfu/${encodeURIComponent(appt.roomName)}?appt=${encodeURIComponent(appt.id)}`
        : `/televisit/${encodeURIComponent(appt.id)}`
      );
      return;
    }
    router.push('/sfu/room-1001');
  };

  // Changed: tabs render forms inline (no redirects)
  const handleTabClick = (t: typeof activeTab) => {
    setActiveTab(t);
    setTabsOpen(true);
  };

  /* ---------- KPI Metrics (placeholders tied to live data) ---------- */
  const kpis = {
    patientsToday: liveAppointments.filter(a => a.status !== 'cancelled').length,
    televisits: liveAppointments.filter(a => a.status === 'checked-in').length,
    ordersPending: 3,
    labPending: 2,
  };

  // Helper: determine if an appointment is for "now" (within ±5 minutes)
  function apptIsNow(candidate: any) {
    const ts = candidate?.start ?? candidate?.when ?? candidate?.startsAt ?? candidate?.whenISO;
    if (!ts) return false;
    const t = Date.parse(ts);
    if (!Number.isFinite(t)) return false;
    const diff = Math.abs(Date.now() - t);
    return diff <= 5 * 60 * 1000; // 5 minutes
  }

  // onSaved handler — if mock mode, update mockAppointments; also triggers refresh key for real mode
  const handleSaved = (payload?: any) => {
    setRefreshKey(k => k + 1);

    if (USE_MOCK) {
      // if payload looks like an appointment, add to mockAppointments
      const apptLike = payload && typeof payload === 'object' && (payload.id || payload.patientName || payload.start);
      if (apptLike) {
        const newAppt: Appointment = {
          id: payload.id ?? `appt-demo-${Date.now()}`,
          patientName: payload.patientName ?? payload.patient?.name ?? 'Demo Patient',
          start: payload.start ?? payload.when ?? new Date().toISOString(),
          end: payload.end ?? (payload.start ? new Date(Date.parse(payload.start) + 30 * 60 * 1000).toISOString() : undefined),
          reason: payload.reason ?? 'Demo booking',
          status: payload.status ?? 'booked',
          priority: payload.priority ?? 'Low',
          roomName: payload.roomName ?? `room-demo-${Math.floor(Math.random() * 1000)}`,
        };
        setMockAppointments(prev => [newAppt, ...prev]);
        setMockProgress(prev => ({ ...prev, [newAppt.id]: { pct: 0, status: 'pre' } }));
        // add inbox event
        setMockInbox(prev => [{ id: `evt-${Date.now()}`, title: `Appointment created: ${newAppt.patientName}`, body: `${newAppt.reason}`, timestamp: new Date().toISOString() }, ...prev]);
        setInbox(prev => [{ id: `evt-${Date.now()}`, title: `Appointment created: ${newAppt.patientName}`, body: `${newAppt.reason}`, timestamp: new Date().toISOString() }, ...prev]);

        // if now, auto-navigate to televisit
        if (apptIsNow(newAppt)) {
          setTimeout(() => {
            router.push(`/televisit/${encodeURIComponent(newAppt.id)}`);
          }, 300);
        }
        return;
      }

      // If payload not an appointment, but forms saved something, just bump refresh key
      return;
    }

    // real mode: payload handling still attempts to auto-televisit if appointment seems immediate
    try {
      const appt = payload && typeof payload === 'object' && (payload.id || payload._id) ? payload : null;
      if (appt && apptIsNow(appt)) {
        const id = appt.id ?? appt._id ?? appt.appointmentId ?? appt.roomId ?? null;
        if (id) {
          setTimeout(() => {
            router.push(`/televisit/${encodeURIComponent(String(id))}`);
          }, 400);
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <main className="p-4 max-w-7xl mx-auto space-y-4">

        {/* Hero Greeting */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Hi Dr. {clinicianName}</h1>
            <p className="text-gray-500 mt-1">
              You have <span className="font-semibold">{kpis.patientsToday}</span> patients today and <span className="font-semibold">{inbox.length}</span> unread notifications.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleStartTelevisit} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition">
              Start Televisit <span className="text-xs bg-white/20 px-2 py-0.5 rounded ml-2">T</span>
            </button>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-xs text-gray-500">Televisits</div>
              <div className="text-xs text-gray-500">Orders</div>
              <div className="text-xs text-gray-500">Labs</div>
              <div className="font-semibold">{kpis.televisits}</div>
              <div className="font-semibold">{kpis.ordersPending}</div>
              <div className="font-semibold">{kpis.labPending}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions / Inline Tabs (now collapsible like Active televisit) */}
        <div className="bg-white rounded-2xl shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-md bg-gray-100 p-1">
              <button className={`px-3 py-2 rounded-md text-sm ${activeTab === 'appointments' ? 'bg-white shadow-sm' : 'text-gray-700'}`} onClick={() => handleTabClick('appointments')}>Create Appointment</button>
              <button className={`px-3 py-2 rounded-md text-sm ${activeTab === 'orders' ? 'bg-white shadow-sm' : 'text-gray-700'}`} onClick={() => handleTabClick('orders')}>New Order</button>
              <button className={`px-3 py-2 rounded-md text-sm ${activeTab === 'notes' ? 'bg-white shadow-sm' : 'text-gray-700'}`} onClick={() => handleTabClick('notes')}>Create Note</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Shortcuts: C — Create appointment</div>
              <CollapseBtn open={tabsOpen} onClick={() => setTabsOpen(v => !v)} />
            </div>
          </div>

          <Collapse open={tabsOpen}>
            <div className="mt-3">
              {/* Inline tab content: render the client components */}
              <div>
                {activeTab === 'appointments' && <AppointmentForm clinicianId={clinicianId} onSaved={handleSaved} />}
                {activeTab === 'orders' && <OrderForm onSaved={handleSaved} />}
                {activeTab === 'notes' && <NoteForm onSaved={handleSaved} />}
              </div>
            </div>
          </Collapse>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            {/* Upcoming Schedule (collapsible) */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upcoming schedule</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">Today</div>
                  <CollapseBtn open={scheduleOpen} onClick={() => setScheduleOpen(v => !v)} />
                </div>
              </div>

              <Collapse open={scheduleOpen}>
                <div className="mt-3 flex items-center justify-between">
                  <div className="w-2/3">
                    <DayProgress appointments={liveAppointments} progressMap={progressMap} />
                  </div>
                  <div className="w-1/3 text-right">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-xl font-semibold">{liveAppointments.length}</div>
                    <div className="text-xs text-gray-500 mt-1">{`${liveAppointments.filter(a => a.status === 'completed').length} completed`}</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {liveAppointments.slice(0, 10).map(a => {
                    const progress = progressMap?.[a.id]?.pct ?? 0;
                    const status = (progressMap?.[a.id]?.status as 'pre'|'ongoing'|'overrun') ?? (a.status === 'completed' ? 'ongoing' : 'pre');
                    const progColor = status === 'pre' ? '#FBBF24' : status === 'ongoing' ? '#22C55E' : '#EF4444';
                    const overrunClass = status === 'overrun' ? 'animate-[shake-subtle_1.2s_infinite]' : '';
                    const patientName = a.patient?.name ?? a.patientName ?? '—';

                    return (
                      <li key={a.id} className={`p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors duration-200 ${overrunClass}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{patientName}</div>
                            <div className="text-xs text-gray-600">{a.reason}</div>
                          </div>
                          <div className={`text-xs px-2 py-1 border rounded font-semibold ${a.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {a.priority ?? 'Low'}
                          </div>
                        </div>
                        {a.start && a.end && (
                          <div className="relative h-4 w-full bg-gray-200 rounded-full overflow-hidden" title={`${progress.toFixed(0)}%`}>
                            <div className="h-4 rounded-full text-xs font-medium text-white" style={{ width: `${progress}%`, backgroundColor: progColor }} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-xs text-gray-500">Start</div>
                          <div className="font-mono text-xs">{a.start ? formatTime(a.start) : '—'}</div>
                          <div className="ml-auto flex items-center gap-2">
                            <StatusPill status={a.status} />
                            <button onClick={() => router.push(a.roomName ? `/sfu/${encodeURIComponent(a.roomName)}?appt=${encodeURIComponent(a.id)}` : `/televisit/${encodeURIComponent(a.id)}`)} className="px-2 py-1 rounded border text-sm">Open</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {liveAppointments.length === 0 && <li className="p-3 text-sm text-gray-500">No appointments for today.</li>}
                </ul>
              </Collapse>
            </section>

            {/* Patient Queue & Calendar (collapsible) */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Patient queue / urgent</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">Sort: priority</div>
                  <CollapseBtn open={queueOpen} onClick={() => setQueueOpen(v => !v)} />
                </div>
              </div>

              <Collapse open={queueOpen}>
                <ul className="mt-3 divide-y">
                  {liveAppointments.map(item => {
                    const progress = progressMap?.[item.id]?.pct ?? 0;
                    const status = (progressMap?.[item.id]?.status as 'pre'|'ongoing'|'overrun') ?? 'pre';
                    const progColor = status === 'pre' ? '#FBBF24' : status === 'ongoing' ? '#22C55E' : '#EF4444';
                    const overrunClass = status === 'overrun' ? 'animate-[shake-subtle_1.2s_infinite]' : '';
                    const patientName = item.patient?.name ?? item.patientName ?? '—';

                    return (
                      <li key={item.id} className={`p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors duration-200 ${overrunClass}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{patientName}</div>
                            <div className="text-xs text-gray-600">{item.reason}</div>
                          </div>
                          <div className={`text-xs px-2 py-1 border rounded font-semibold ${item.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {item.priority ?? 'Low'}
                          </div>
                        </div>
                        {item.start && item.end && (
                          <div className="relative h-4 w-full bg-gray-200 rounded-full overflow-hidden" title={`${progress.toFixed(0)}%`}>
                            <div className="h-4 rounded-full text-xs font-medium text-white" style={{ width: `${progress}%`, backgroundColor: progColor }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {liveAppointments.length === 0 && <li className="p-3 text-sm text-gray-500">No patients in queue.</li>}
                </ul>
              </Collapse>

              {/* Collapsible Calendar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">My Calendar</div>
                  <CollapseBtn open={calendarOpen} onClick={() => setCalendarOpen(v => !v)} />
                </div>
                <Collapse open={calendarOpen}>
                  {USE_MOCK ? (
                    <MockCalendarPreview clinicianId={clinicianId} days={14} appointments={mockAppointments} />
                  ) : (
                    <CalendarPreview clinicianId={clinicianId} days={14} apiBase="/api/schedule/slots/batch" />
                  )}
                </Collapse>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            {/* Televisit Panel */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Active televisit</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">Live vitals</div>
                  <CollapseBtn open={teleOpen} onClick={() => setTeleOpen(v => !v)} />
                </div>
              </div>
              <Collapse open={teleOpen}>
                <div className="mt-3">
                  <div className="rounded border p-3 text-sm text-gray-600">Click Open Televisit to begin.</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {['HR', 'SpO₂', 'BP', 'Temp'].map(label => (
                      <div key={label} className="border rounded p-2 text-xs">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-lg font-semibold">{label === 'SpO₂' ? '98 %' : label === 'Temp' ? '36.8 °C' : '72 bpm'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-right">
                    <button onClick={() => router.push('/sfu/room-1001')} className="px-3 py-1 rounded border">Open televisit</button>
                  </div>
                </div>
              </Collapse>
              {!teleOpen && <div className="mt-3 text-xs text-gray-500">Summary hidden — expand to see vitals and quick actions.</div>}
            </section>

            {/* Inbox Panel */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications / Inbox</h3>
                <CollapseBtn open={notifOpen} onClick={() => setNotifOpen(v => !v)} />
              </div>
              <Collapse open={notifOpen}>
                <div className="mt-3 max-h-80 overflow-y-auto">
                  {loadingInbox ? <div className="text-sm text-gray-500">Loading…</div> :
                    inbox.length ? inbox.map(e => (
                      <div key={e.id} className="p-2 border-b last:border-b-0 text-sm">
                        <div className="font-medium">{e.title}</div>
                        {e.body && <div className="text-gray-600 text-xs">{e.body}</div>}
                        <div className="text-gray-400 text-xs">{new Date(e.timestamp).toLocaleTimeString()}</div>
                      </div>
                    )) : <div className="text-sm text-gray-500">No notifications.</div>}
                </div>
              </Collapse>
            </section>

            {/* KPI Tiles */}
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Patients Today</div>
                  <div className="text-lg font-semibold">{kpis.patientsToday}</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Televisits</div>
                  <div className="text-lg font-semibold">{kpis.televisits}</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Orders Pending</div>
                  <div className="text-lg font-semibold">{kpis.ordersPending}</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500">Lab Pending</div>
                  <div className="text-lg font-semibold">{kpis.labPending}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
