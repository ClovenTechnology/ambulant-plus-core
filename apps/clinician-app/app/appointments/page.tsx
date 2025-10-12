// apps/clinician-app/app/appointments/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  CartesianGrid,
} from 'recharts';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? 'http://localhost:3010';

type Appt = {
  id: string;
  patientId: string;
  patientName?: string;
  startsAt: string;
  endsAt: string;
  status: 'booked' | 'completed' | 'canceled' | string;
  reason?: string;
  notes?: string;
};

const MOCK_APPOINTMENTS: Appt[] = [
  { id: 'enc-1001', patientId: 'PT-1001', patientName: 'Nomsa Dlamini', startsAt: new Date(Date.now() - 40 * 60_000).toISOString(), endsAt: new Date(Date.now() - 20 * 60_000).toISOString(), status: 'completed', reason: 'Hypertension review', notes: 'BP improved' },
  { id: 'enc-1002', patientId: 'PT-1002', patientName: 'Thabo Mbeki', startsAt: new Date(Date.now() + 10 * 60_000).toISOString(), endsAt: new Date(Date.now() + 30 * 60_000).toISOString(), status: 'booked', reason: 'Post-op check', notes: '' },
  { id: 'enc-1003', patientId: 'PT-1003', patientName: 'Lerato Mokoena', startsAt: new Date(Date.now() + 90 * 60_000).toISOString(), endsAt: new Date(Date.now() + 110 * 60_000).toISOString(), status: 'booked', reason: 'Cough', notes: '' },
  { id: 'enc-1004', patientId: 'PT-1004', patientName: 'Sipho Nkosi', startsAt: new Date(Date.now() - 150 * 60_000).toISOString(), endsAt: new Date(Date.now() - 120 * 60_000).toISOString(), status: 'canceled', reason: 'Flu', notes: 'Patient canceled' },
];

function isoToLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  // produce yyyy-mm-ddThh:mm for datetime-local
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string) {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return d.toISOString();
}

export default function ClinicianAppointments({ clinicianId = 'clin-za-001' }: { clinicianId?: string }) {
  const [items, setItems] = useState<Appt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [editing, setEditing] = useState<Appt | null>(null); // temp edit in modal

  // load appointments (try API, fallback to mock)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${GATEWAY}/api/appointments?clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const arr = Array.isArray(j.items) ? j.items : Array.isArray(j) ? j : (j?.items || []);
        if (!arr || arr.length === 0) throw new Error('No items');
        setItems(arr.map((a: any) => ({
          id: a.id ?? a._id ?? String(a.id ?? Date.now()),
          patientId: a.patientId ?? a.patient?.id ?? a.patient?.identifier ?? 'PT-XXXX',
          patientName: a.patient?.name ?? a.patientName ?? a.patient?.fullName ?? undefined,
          startsAt: a.startsAt ?? a.when ?? a.whenISO ?? new Date().toISOString(),
          endsAt: a.endsAt ?? a.endsAt ?? new Date(Date.now() + 20*60_000).toISOString(),
          status: (a.status || 'booked').toString(),
          reason: a.reason ?? a.title ?? '',
          notes: a.notes ?? '',
        })));
      } catch (e) {
        // fallback to mock
        setErr(null);
        setItems(MOCK_APPOINTMENTS);
      }
    })();
  }, [clinicianId]);

  const now = useMemo(() => new Date(), []);

  // KPI calculation (derived)
  const calcKPIs = (appts: Appt[]) => {
    const total = appts.length;
    const upcoming = appts.filter(a => new Date(a.startsAt) > new Date()).length;
    const completed = appts.filter(a => a.status === 'completed').length;
    const avgDuration = appts.length
      ? Math.round(appts.reduce((s, a) => s + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000, 0) / appts.length)
      : 0;
    return { total, upcoming, completed, avgDuration };
  };

  const [kpis, setKpis] = useState(() => calcKPIs(MOCK_APPOINTMENTS));

  // sparkline dataset for last 7 days (MM-DD label)
  const last7 = useMemo(() => {
    const days: { date: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const s = new Date(d); s.setHours(0,0,0,0);
      const e = new Date(d); e.setHours(23,59,59,999);
      days.push({ date: d.toISOString().slice(5,10), start: s, end: e });
    }
    return days;
  }, []);

  const sparkDataFor = (appts: Appt[], status?: string) => {
    return last7.map(d => ({
      date: d.date,
      value: appts.filter(a => {
        const s = new Date(a.startsAt);
        return s >= d.start && s <= d.end && (!status || a.status === status);
      }).length,
    }));
  };

  const totalSpark = useMemo(() => sparkDataFor(items, undefined), [items]);
  const completedSpark = useMemo(() => sparkDataFor(items, 'completed'), [items]);
  const upcomingSpark = useMemo(() => {
    const tot = sparkDataFor(items, undefined);
    return tot.map((t, i) => ({ date: t.date, value: Math.max(0, t.value - (completedSpark[i]?.value || 0)) }));
  }, [items, completedSpark]);

  // trend helper
  const getTrendSymbol = (data: { value: number }[]) => {
    if (data.length < 2) return '→';
    const l = data[data.length - 1].value;
    const p = data[data.length - 2].value;
    return l > p ? '↑' : l < p ? '↓' : '→';
  };

  // update appointment (live local update + KPI recalc)
  const updateAppointment = (id: string, patch: Partial<Appt>) => {
    setItems(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      setKpis(calcKPIs(next));
      return next;
    });
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } as Appt : prev);
    if (editing?.id === id) setEditing(prev => prev ? ({ ...prev, ...patch }) : prev);
  };

  // Cancel appointment helper
  const cancelAppointment = (id: string) => updateAppointment(id, { status: 'canceled' });

  // Open modal to view/edit
  const openModal = (a: Appt) => {
    setSelected(a);
    // create a shallow edit copy
    setEditing({ ...a });
  };

  // apply edits in modal -> commit to list and close optional
  const commitEdit = (saveAndClose = true) => {
    if (!editing) return;
    updateAppointment(editing.id, editing);
    if (saveAndClose) {
      // small delay to show KPI ripple
      setTimeout(() => { setSelected(null); setEditing(null); }, 180);
    }
  };

  // When items change from API fetch, update KPIs
  useEffect(() => {
    setKpis(calcKPIs(items));
  }, [items]);

  // add appointment (quick create demo)
  const quickAdd = () => {
    const id = `enc-${Date.now()}`;
    const start = new Date(Date.now() + 15*60_000).toISOString();
    const end = new Date(Date.now() + 35*60_000).toISOString();
    const newAppt: Appt = {
      id,
      patientId: `PT-${Math.floor(Math.random()*9000)+1000}`,
      patientName: `Demo Patient ${String(Math.random()).slice(2,6)}`,
      startsAt: start,
      endsAt: end,
      status: 'booked',
      reason: 'Ad-hoc (demo)',
      notes: '',
    };
    setItems(prev => { const next = [newAppt, ...prev]; setKpis(calcKPIs(next)); return next; });
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <motion.h1 className="text-2xl font-semibold" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>Appointments Dashboard</motion.h1>
          <div className="text-sm text-gray-500 mt-1">Clinician view · Virtual consultations only</div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            onClick={quickAdd}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 focus:outline-none"
            title="Create a demo appointment"
          >
            + Add Appointment
          </motion.button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Total Appointments', value: kpis.total, data: totalSpark, color: '#3b82f6' },
          { title: 'Upcoming', value: kpis.upcoming, data: upcomingSpark, color: '#f59e0b' },
          { title: 'Completed', value: kpis.completed, data: completedSpark, color: '#10b981' },
          { title: 'Avg. Duration (min)', value: kpis.avgDuration, data: [], color: '#8b5cf6' },
        ].map((card, i) => (
          <motion.div key={card.title}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="relative bg-white rounded p-4 shadow hover:shadow-lg overflow-hidden"
            >
            {/* subtle shimmer */}
            <motion.div className="absolute inset-0 pointer-events-none"
              animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.00) 100%)' }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">{card.title}</div>
                <div
                  className="text-sm"
                  aria-hidden
                >
                  <motion.span
                    key={getTrendSymbol(card.data)}
                    animate={getTrendSymbol(card.data) === '↑' ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1, repeat: getTrendSymbol(card.data) === '↑' ? Infinity : 0 }}
                    className="text-xs ml-2 text-gray-400"
                  >
                    {getTrendSymbol(card.data)}
                  </motion.span>
                </div>
              </div>

              <motion.div className="text-2xl font-semibold mt-1" layout>{card.value}</motion.div>

              <div className="h-16 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={card.data.length ? card.data : last7.map(d => ({ date: d.date, value: 0 }))}>
                    <defs>
                      <linearGradient id={`g-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.color} stopOpacity={0.35}/>
                        <stop offset="100%" stopColor={card.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v: any) => [v, 'count']} labelFormatter={(l) => `Date: ${l}`} />
                    <Area type="monotone" dataKey="value" stroke={card.color} strokeWidth={2} fill={`url(#g-${i})`} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      {/* Appointments list */}
      <div className="bg-white border rounded divide-y mt-4">
        {items.length === 0 && <div className="p-4 text-sm text-gray-500">No appointments yet.</div>}
        {items.map((a, idx) => {
          const isOngoing = new Date() >= new Date(a.startsAt) && new Date() <= new Date(a.endsAt);
          const readOnly = a.status === 'completed' || a.status === 'canceled';
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-gray-50 cursor-pointer ${isOngoing ? 'bg-emerald-50' : ''}`}
              onClick={() => openModal(a)}
              title="Click to view / edit"
            >
              <div>
                <div className="font-medium">{a.reason || 'Consult'}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {a.patientName ?? a.patientId} · {new Date(a.startsAt).toLocaleString()} – {new Date(a.endsAt).toLocaleTimeString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs px-2 py-0.5 rounded border font-semibold text-gray-700">
                  {a.status}
                </div>

                {!readOnly && (
                  <>
                    <motion.button onClick={(e) => { e.stopPropagation(); window.open(`/sfu/room-${a.id}`, '_blank'); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm">Join</motion.button>

                    <motion.button onClick={(e) => { e.stopPropagation(); openModal(a); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="px-3 py-1 rounded border bg-yellow-50 hover:bg-yellow-100 text-sm">Reschedule</motion.button>

                    <motion.button onClick={(e) => { e.stopPropagation(); cancelAppointment(a.id); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="px-3 py-1 rounded border bg-red-50 hover:bg-red-100 text-sm">Cancel</motion.button>
                  </>
                )}

                <motion.button onClick={(e) => { e.stopPropagation(); openModal(a); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="px-3 py-1 rounded border bg-blue-50 hover:bg-blue-100 text-sm">View</motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal: view / edit appointment + tiny sparkline preview showing hypothetical KPI impact */}
      <AnimatePresence>
        {selected && editing && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setSelected(null); setEditing(null); }}
          >
            <motion.div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-lg"
              initial={{ y: 10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{editing.reason}</h2>
                  <div className="text-sm text-gray-500 mt-1">{editing.patientName} · {editing.patientId}</div>
                </div>
                <div className="text-sm text-gray-500">{editing.status}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="block text-xs text-gray-600">Start</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(editing.startsAt)}
                    onChange={(e) => setEditing({ ...editing, startsAt: localInputToIso(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    disabled={editing.status === 'completed'}
                  />

                  <label className="block text-xs text-gray-600 mt-2">End</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(editing.endsAt)}
                    onChange={(e) => setEditing({ ...editing, endsAt: localInputToIso(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    disabled={editing.status === 'completed'}
                  />

                  <label className="block text-xs text-gray-600 mt-2">Status</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    <option value="booked">Booked</option>
                    <option value="completed">Completed</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-gray-600">Notes</label>
                  <textarea className="w-full border rounded px-3 py-2 min-h-[120px]" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />

                  {/* Tiny sparkline preview showing impact on KPIs */}
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Preview: KPI impact (if you save changes)</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Total', dataKey: 'total', color: '#3b82f6', data: totalSpark },
                        { label: 'Upcoming', dataKey: 'upcoming', color: '#f59e0b', data: upcomingSpark },
                        { label: 'Completed', dataKey: 'completed', color: '#10b981', data: completedSpark },
                      ].map((card, idx) => {
                        // compute hypothetical data: apply editing changes to a temp copy of items
                        const tempItems = items.map(it => it.id === editing.id ? editing : it);
                        // For completed preview: if editing.status === 'completed', that day increments completed count
                        const tempSpark = sparkDataFor(tempItems, card.label === 'Completed' ? 'completed' : undefined);
                        return (
                          <div key={card.label} className="bg-gray-50 p-2 rounded">
                            <div className="text-[11px] text-gray-600 mb-1 flex items-center justify-between">
                              <span>{card.label}</span>
                            </div>
                            <div className="h-14">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={tempSpark}>
                                  <defs>
                                    <linearGradient id={`mg-${card.label}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={card.color} stopOpacity={0.35}/>
                                      <stop offset="100%" stopColor={card.color} stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="date" hide />
                                  <YAxis hide />
                                  <Tooltip formatter={(v: any) => [v, 'count']} labelFormatter={(l) => `Date: ${l}`} />
                                  <Area type="monotone" dataKey="value" stroke={card.color} strokeWidth={2} fill={`url(#mg-${card.label}-${idx})`} dot={{ r: 2 }} activeDot={{ r: 6 }} isAnimationActive />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                {editing.status !== 'completed' && editing.status !== 'canceled' && (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { updateAppointment(editing.id, { status: 'canceled' }); setSelected(null); setEditing(null); }}
                    className="px-4 py-2 bg-red-50 rounded border hover:bg-red-100">Cancel</motion.button>
                )}
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { commitEdit(true); }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded">Save & Close</motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { commitEdit(false); }}
                  className="px-4 py-2 bg-gray-100 rounded border">Save</motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setSelected(null); setEditing(null); }}
                  className="px-4 py-2 bg-white rounded border">Close</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
