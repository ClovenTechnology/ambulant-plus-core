// apps/clinician-app/app/patients/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from 'recharts';
import { MOCK_PATIENTS } from '@/mock/patients';
import { useLiveAppointments } from '@/src/hooks/useLiveAppointments';

type Patient = {
  id: string;
  name: string;
  dob?: string;
  gender?: string;
  email?: string;
  phone?: string;
  location?: string;
  tags?: string[];
  lastSeen?: string; // ISO
  risk?: 'low' | 'medium' | 'high';
  timeline?: { ts: string; type: string; note?: string }[];
};

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

/* ---------- helpers ---------- */
function formatLongDateISO(iso?: string | number) {
  try {
    const d = typeof iso === 'number' ? new Date(iso) : new Date(iso || '');
    if (!isFinite(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}
function daysAgoLabel(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** compute last 7 days counts and return readable date strings for tooltips */
function computeLast7Counts(items: Patient[], filter?: (p: Patient) => boolean) {
  const now = new Date();
  const out: { date: string; value: number; iso: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const start = new Date(day.setHours(0, 0, 0, 0));
    const end = new Date(day.setHours(23, 59, 59, 999));
    const count = items.filter((p) => {
      if (filter && !filter(p)) return false;
      const t = (p.timeline || []).some((t) => {
        const ts = Date.parse(t.ts || '');
        if (!isFinite(ts)) return false;
        return ts >= start.getTime() && ts <= end.getTime();
      });
      const ls = p.lastSeen ? Date.parse(p.lastSeen) : NaN;
      const lsIn = isFinite(ls) && ls >= start.getTime() && ls <= end.getTime();
      return t || lsIn;
    }).length;
    out.push({ date: start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }), value: count, iso: start.toISOString() });
  }
  // recharts expects objects with keys; we'll return date & value — tooltip formatter will show the date string
  return out.map(({ date, value }) => ({ date, value }));
}

function TrendArrow({ data }: { data: { value: number }[] }) {
  const last = data.length ? data[data.length - 1].value : 0;
  const prev = data.length > 1 ? data[data.length - 2].value : last;
  const diff = last - prev;
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  return (
    <motion.span
      aria-hidden
      initial={{ scale: 0.95, opacity: 0.9 }}
      animate={{ scale: diff > 0 ? [1, 1.06, 1] : 1, opacity: 1 }}
      transition={{ duration: 0.9, repeat: diff > 0 ? Infinity : 0, repeatDelay: 2 }}
      className={`ml-2 text-xs ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-gray-400'}`}
      title={`Change: ${diff >= 0 ? '+' : ''}${diff}`}
    >
      {arrow}
    </motion.span>
  );
}

/* KPI card */
function KpiCard({ title, value, data, color }: { title: string; value: number; data: any[]; color: string }) {
  const gradientId = `grad-${title.replace(/\s+/g, '-')}`;
  // Recharts tooltip will pass the label (our date string) — we show full readable date
  return (
    <motion.div className="p-4 rounded-lg bg-white shadow-sm hover:shadow-lg transition-shadow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 flex items-center">
          {title}
          <TrendArrow data={data.length ? data : [{ value: 0 }, { value }]} />
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </div>

      <div className="mt-2 h-14">
        {data && data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={false}
                contentStyle={{ fontSize: 12 }}
                formatter={(val: any) => [`${val}`, '']}
                labelFormatter={(label: any) => `Date: ${label}`} // label is our readable date string
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
            <svg width="100%" height="44" viewBox="0 0 100 44" preserveAspectRatio="none">
              <path d="M0 30 L20 24 L40 28 L60 20 L80 26 L100 22" stroke="#e5e7eb" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* Patient editable drawer/modal (side-drawer on md+, modal on small) */
function PatientDrawer({
  patient,
  onClose,
  onSave,
  onReschedule,
  onCancelAppt,
  appointmentsForPatient,
}: {
  patient: Patient | null;
  onClose: () => void;
  onSave: (p: Patient) => void;
  onReschedule: (p: Patient, newWhenISO: string) => void;
  onCancelAppt: (p: Patient, apptTs?: string) => void;
  appointmentsForPatient: any[];
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<Patient | null>(patient);

  useEffect(() => setLocal(patient), [patient]);

  if (!patient || !local) return null;

  const lastSeen = local.lastSeen ? new Date(local.lastSeen).toLocaleString() : '—';

  // small helper for preview/print: generate simple HTML for appointments
  const openPrintablePreview = () => {
    const html = `
      <html>
      <head>
        <title>Appointment Preview - ${local.name}</title>
        <style>
         body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 20px; color:#111827 }
         .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px }
         .card { border:1px solid #e5e7eb; padding:12px; border-radius:8px; margin-bottom:8px }
         h1 { margin:0; font-size:20px }
         p { margin:0; color:#6b7280; font-size:13px }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Ambulant+ — Appointment Preview</h1>
            <p>Clinician: Demo • Patient: ${local.name} (${local.id})</p>
          </div>
          <div><small>${new Date().toLocaleString()}</small></div>
        </div>
        ${appointmentsForPatient.map(a => `<div class="card"><strong>${a.reason || 'Consult'}</strong><div>${new Date(a.startsAt).toLocaleString()} - ${new Date(a.endsAt).toLocaleTimeString()}</div><div>Status: ${a.status}</div></div>`).join('')}
        <footer style="margin-top:18px;color:#9ca3af;font-size:12px">Order created from MedReach by Ambulant+</footer>
      </body>
      </html>
    `;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="absolute right-0 top-0 h-full w-full md:w-[720px] bg-white shadow-xl overflow-auto"
      >
        <div className="p-4 border-b flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{local.name}</h2>
            <div className="text-xs text-gray-500">ID: {local.id} • Last seen: {lastSeen}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" onClick={onClose}>Close</button>
            <button
              className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                // Start Televisit: open SFU fallback
                window.open('/sfu/room-1001', '_blank');
              }}
            >
              Start Televisit
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Name</div>
              <input className="w-full border rounded px-2 py-1" value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} disabled={!editing} />
            </div>
            <div>
              <div className="text-xs text-gray-500">Location</div>
              <input className="w-full border rounded px-2 py-1" value={local.location || ''} onChange={(e) => setLocal({ ...local, location: e.target.value })} disabled={!editing} />
            </div>
            <div>
              <div className="text-xs text-gray-500">Tags</div>
              <input className="w-full border rounded px-2 py-1" value={(local.tags || []).join(', ')} onChange={(e) => setLocal({ ...local, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} disabled={!editing} />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Notes / Timeline (latest 8)</div>
            <div className="mt-2 space-y-2">
              {(local.timeline || []).slice(-8).reverse().map((t, i) => (
                <div key={i} className="text-sm p-2 border rounded bg-gray-50">
                  <div className="text-xs text-gray-400">{new Date(t.ts).toLocaleString()} • {t.type}</div>
                  <div className="mt-1">{t.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className={`px-3 py-1 rounded text-sm border ${editing ? 'bg-white' : 'bg-gray-50'}`}
              onClick={() => {
                if (editing) onSave(local);
                setEditing(v => !v);
              }}
            >
              {editing ? 'Save' : 'Edit'}
            </button>

            <button className="px-3 py-1 rounded text-sm border bg-white hover:bg-gray-50"
              onClick={() => {
                const newWhen = new Date().toISOString();
                onReschedule(local, newWhen);
              }}
            >
              Reschedule (to now)
            </button>

            <button className="px-3 py-1 rounded text-sm border bg-white hover:bg-gray-50" onClick={() => onCancelAppt(local)}>
              Cancel Appointment
            </button>

            <button className="px-3 py-1 rounded text-sm border bg-white hover:bg-gray-50" onClick={openPrintablePreview}>
              Preview (printable)
            </button>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Activity preview (last 7 days)</div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(local.timeline || []).length ? (local.timeline || []).slice(-7).map((t, i) => ({ date: daysAgoLabel(new Date(Date.now() - (6 - i) * 86400000)), value: 1 })) : [{ date: daysAgoLabel(new Date()), value: 0 }]}>
                  <XAxis dataKey="date" hide />
                  <Tooltip formatter={(v: any) => [`${v}`, '']} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* Create appointment drawer (desktop) + modal fallback for mobile */
function CreateAppointmentDrawer({
  open,
  onClose,
  patients,
  clinicianId,
  onCreated,
  refreshKeyBump,
}: {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  clinicianId: string;
  onCreated: (appt: any) => void;
  refreshKeyBump: () => void;
}) {
  const [patientId, setPatientId] = useState<string>('');
  const [whenISO, setWhenISO] = useState<string>(new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState<string>('Televisit');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPatientId('');
      setWhenISO(new Date().toISOString().slice(0, 16));
      setReason('Televisit');
      setErr(null);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        clinicianId,
        patientId,
        startsAt: new Date(whenISO).toISOString(),
        endsAt: new Date(Date.parse(new Date(whenISO).toISOString()) + 20 * 60000).toISOString(),
        reason,
        status: 'booked',
      };
      const r = await fetch('/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(txt || `HTTP ${r.status}`);
      }
      const j = await r.json();
      onCreated(j);
      refreshKeyBump();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Failed to create appointment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Drawer: desktop wide */}
      <div className={`fixed inset-y-0 right-0 z-40 w-full md:w-[420px] transform transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full bg-white border-l shadow-lg p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Create Appointment</h3>
            <button className="px-3 py-1 rounded border" onClick={onClose}>Close</button>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-gray-500">Patient</label>
            <select className="w-full border rounded px-2 py-1" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} — {p.id}</option>)}
            </select>

            <label className="text-xs text-gray-500">When (local)</label>
            <input className="w-full border rounded px-2 py-1" type="datetime-local" value={whenISO} onChange={(e) => setWhenISO(e.target.value)} />

            <label className="text-xs text-gray-500">Reason</label>
            <input className="w-full border rounded px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value)} />

            {err && <div className="text-sm text-rose-600">{err}</div>}

            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
              <button className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50" onClick={submit} disabled={busy || !patientId}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal fallback for mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="relative w-full max-w-md bg-white rounded p-4">
            <h3 className="text-lg font-semibold mb-2">Create Appointment</h3>
            <label className="text-xs text-gray-500">Patient</label>
            <select className="w-full border rounded px-2 py-1" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} — {p.id}</option>)}
            </select>

            <label className="text-xs text-gray-500 mt-2">When (local)</label>
            <input className="w-full border rounded px-2 py-1" type="datetime-local" value={whenISO} onChange={(e) => setWhenISO(e.target.value)} />

            <label className="text-xs text-gray-500 mt-2">Reason</label>
            <input className="w-full border rounded px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value)} />

            <div className="flex gap-2 mt-3">
              <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
              <button className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50" onClick={submit} disabled={busy || !patientId}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- main page ---------- */
export default function PatientsPage() {
  // enrich MOCK_PATIENTS with seeded lastSeen and timeline (past + a few upcoming visits)
  const seeded = useMemo<Patient[]>(() => {
    const now = Date.now();
    // helper to ISO date +/- days
    const isoOffset = (daysOffset: number, minutesOffset = 0) => new Date(now + daysOffset * 86400000 + minutesOffset * 60000).toISOString();

    return (MOCK_PATIENTS || []).map((p, idx) => {
      // clone
      const copy: Patient = { ...p };
      copy.timeline = copy.timeline ? [...copy.timeline] : [];

      // Add 1-3 past visits for most patients
      const pastCount = idx % 3 === 0 ? 0 : 1 + (idx % 3); // variety
      for (let i = 0; i < pastCount; i++) {
        const daysAgo = 2 + i + (idx % 5);
        copy.timeline.push({
          ts: isoOffset(-daysAgo, (i + 1) * 10),
          type: 'completed',
          note: 'Past consult (demo)',
        });
      }

      // Add upcoming visits for some patients
      if (idx % 4 === 0) {
        // schedule an upcoming visit in 1-3 days
        const daysAhead = 1 + (idx % 3);
        copy.timeline.push({
          ts: isoOffset(daysAhead, 15),
          type: 'appointment',
          note: 'Upcoming televisit (demo)',
        });
      }

      // Occasionally add a cancelled or no-show
      if (idx % 7 === 0) {
        copy.timeline.push({ ts: isoOffset(-1 - (idx % 4)), type: 'no-show', note: 'No-show (demo)' });
      }
      if (idx % 11 === 0) {
        copy.timeline.push({ ts: isoOffset(-3 - (idx % 5)), type: 'cancelled', note: 'Cancelled (demo)' });
      }

      // ensure lastSeen is the latest timeline ts or a random recent date
      const times = (copy.timeline || []).map(t => Date.parse(t.ts || '')).filter(Boolean);
      if (times.length) {
        copy.lastSeen = new Date(Math.max(...times)).toISOString();
      } else {
        // fallback lastSeen within last 30 days
        const randomDays = -(1 + (idx % 28));
        copy.lastSeen = isoOffset(randomDays);
      }

      // risk spread
      if (!copy.risk) {
        copy.risk = idx % 10 === 0 ? 'high' : idx % 5 === 0 ? 'medium' : 'low';
      }

      return copy;
    });
  }, []);

  const [patients, setPatients] = useState<Patient[]>(seeded);
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);
  const [drawerOpenState, setDrawerOpenState] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind?: 'success' | 'error'; undo?: () => void } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(patients.length / pageSize));

  // wire useLiveAppointments with refreshKey to force refetch when refreshKey changes
  const clinicianId = 'clin-demo';
  const clinicianHookArg = `${clinicianId}::${refreshKey}`;
  const live = useLiveAppointments?.(clinicianHookArg) ?? { appointments: [], progressMap: {} };

  // Merge live appointments into patient timelines (non-destructive, presentation-friendly)
  useEffect(() => {
    if (!live || !Array.isArray(live.appointments)) return;
    setPatients(prev => {
      const byId = new Map(prev.map(p => [p.id, { ...p }]));
      for (const a of live.appointments) {
        const pid = a.patientId || a.patient?.id;
        if (!pid) continue;
        const p = byId.get(pid);
        const ts = a.startsAt || a.when || a.whenISO || a.timestamp || a.createdAt || new Date().toISOString();
        if (p) {
          const timeline = p.timeline ? [...p.timeline] : [];
          // avoid duplicating same ts+type
          if (!timeline.some(t => t.ts === ts && t.type === 'appointment')) {
            timeline.push({ ts, type: 'appointment', note: a.reason || 'Televisit' });
            p.timeline = timeline;
            p.lastSeen = ts;
            byId.set(pid, { ...p });
          }
        } else {
          // ignore unknown patient for now
        }
      }
      return Array.from(byId.values());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(live?.appointments || [])]);

  // KPI calculations, including past visits
  const now = useMemo(() => new Date(), []);
  const total = patients.length;
  const upcoming = patients.filter((p) => (p.timeline || []).some(t => (t.type === 'appointment' || t.type === 'scheduled') && new Date(t.ts) > new Date())).length;
  const highRisk = patients.filter(p => p.risk === 'high').length;
  const noShows = patients.filter((p) => (p.timeline || []).some(t => t.type === 'no-show')).length;

  // Past visits: timeline entries with ts < now and type completed/appointment
  const pastVisitsCount = patients.reduce((acc, p) => {
    const c = (p.timeline || []).filter(t => {
      const ts = Date.parse(t.ts || '');
      if (!isFinite(ts)) return false;
      return ts < Date.now() && (t.type === 'completed' || t.type === 'appointment' || t.type === 'visit');
    }).length;
    return acc + c;
  }, 0);

  const totalSpark = computeLast7Counts(patients);
  const upcomingSpark = computeLast7Counts(patients, (p) => (p.timeline || []).some(t => (t.type === 'appointment' || t.type === 'scheduled') && new Date(t.ts) > new Date()));
  const highRiskSpark = computeLast7Counts(patients, (p) => p.risk === 'high');
  const pastVisitsSpark = (() => {
    // produce counts of total past visits per day (for KPI)
    const nowDate = new Date();
    const out: { date: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(nowDate);
      day.setDate(nowDate.getDate() - i);
      const start = new Date(day.setHours(0, 0, 0, 0));
      const end = new Date(day.setHours(23, 59, 59, 999));
      let count = 0;
      for (const p of patients) {
        count += (p.timeline || []).filter(t => {
          const ts = Date.parse(t.ts || '');
          if (!isFinite(ts)) return false;
          return ts >= start.getTime() && ts <= end.getTime() && (t.type === 'completed' || t.type === 'appointment' || t.type === 'visit');
        }).length;
      }
      out.push({ date: start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }), value: count });
    }
    return out;
  })();

  // keep a ref to the previous patients snapshot for undo
  const prevSnapshotRef = useRef<Patient[] | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // filter
  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (query) {
        const q = query.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.email || '').toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) return false;
      }
      if (genderFilter && p.gender !== genderFilter) return false;
      if (locationFilter && p.location !== locationFilter) return false;
      return true;
    });
  }, [patients, query, genderFilter, locationFilter]);

  const refreshKeyBump = useCallback(() => setRefreshKey(k => k + 1), []);

  // create ad-hoc appointment (used by card button & Start Televisit start)
  const createAppointmentFor = async (p: Patient | null) => {
    if (!p) return;
    try {
      const payload = {
        clinicianId,
        patientId: p.id,
        patientName: p.name,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 20 * 60000).toISOString(),
        reason: 'Ad-hoc (created from patients page)',
        status: 'booked',
      };
      const r = await fetch('/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('backend-failed');
      const j = await r.json();
      setPatients(prev => prev.map(x => x.id === p.id ? { ...x, timeline: [...(x.timeline || []), { ts: payload.startsAt, type: 'appointment', note: payload.reason }], lastSeen: payload.startsAt } : x));
      setToast({ msg: 'Appointment created', kind: 'success' });
      refreshKeyBump();
      window.open('/sfu/room-1001', '_blank');
      return j;
    } catch (e: any) {
      // fallback local creation
      const ts = new Date().toISOString();
      setPatients(prev => prev.map(x => x.id === p.id ? { ...x, timeline: [...(x.timeline || []), { ts, type: 'appointment', note: 'Ad-hoc (local)' }], lastSeen: ts } : x));
      setToast({ msg: 'Appointment created (local fallback)', kind: 'success' });
      refreshKeyBump();
    }
  };

  const savePatient = (updated: Patient) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
    setToast({ msg: 'Patient updated', kind: 'success' });
    refreshKeyBump();
  };

  const rescheduleAppointment = (p: Patient, newWhenISO: string) => {
    // keep snapshot for undo
    prevSnapshotRef.current = JSON.parse(JSON.stringify(patients));
    setPatients(prev => prev.map(x => x.id === p.id ? { ...x, timeline: [...(x.timeline || []), { ts: newWhenISO, type: 'appointment', note: 'Rescheduled via modal' }], lastSeen: newWhenISO } : x));
    setToast({ msg: 'Appointment rescheduled (demo)', kind: 'success', undo: () => {
      if (prevSnapshotRef.current) setPatients(prevSnapshotRef.current);
      refreshKeyBump();
      setToast({ msg: 'Undo: reschedule reverted', kind: 'success' });
    }});
    refreshKeyBump();
  };

  const cancelAppointment = (p: Patient) => {
    prevSnapshotRef.current = JSON.parse(JSON.stringify(patients));
    setPatients(prev => prev.map(x => x.id === p.id ? { ...x, timeline: [...(x.timeline || []), { ts: new Date().toISOString(), type: 'cancelled', note: 'Cancelled via modal' }] } : x));
    setToast({ msg: 'Appointment cancelled (demo)', kind: 'success', undo: () => {
      if (prevSnapshotRef.current) setPatients(prevSnapshotRef.current);
      refreshKeyBump();
      setToast({ msg: 'Undo: cancel reverted', kind: 'success' });
    }});
    refreshKeyBump();
  };

  // Get appointments for a patient from live.appointments fallback to mock (presentation)
  const appointmentsForPatient = useCallback((pid: string) => {
    const liveA = (live && Array.isArray(live.appointments)) ? live.appointments.filter(a => a.patientId === pid) : [];
    if (liveA && liveA.length) return liveA;
    // fallback to mapping from patient.timeline
    const p = patients.find(x => x.id === pid);
    if (!p) return [];
    return (p.timeline || []).map((t, idx) => ({
      id: `${pid}-tl-${idx}`,
      patientId: pid,
      patientName: p.name,
      startsAt: t.ts,
      endsAt: new Date(Date.parse(t.ts) + 20 * 60000).toISOString(),
      status: t.type === 'cancelled' ? 'cancelled' : (t.type === 'no-show' ? 'no-show' : 'completed'),
      reason: t.note || 'Record',
    }));
  }, [live, patients]);

  // Build upcoming appointments list (next 5) across all patients (live first)
  const upcomingAppointments = useMemo(() => {
    const all: any[] = [];

    // live appointments (if any)
    if (live && Array.isArray(live.appointments)) {
      for (const a of live.appointments) {
        const ts = Date.parse(a.startsAt || a.when || a.whenISO || a.timestamp || '');
        if (!isFinite(ts)) continue;
        if (ts > Date.now()) {
          all.push({
            id: a.id || `live-${Math.random().toString(36).slice(2, 8)}`,
            patientId: a.patientId,
            patientName: a.patientName || a.patient?.name || (patients.find(p => p.id === a.patientId)?.name ?? 'Unknown'),
            startsAt: a.startsAt || a.when || a.whenISO,
            reason: a.reason || 'Televisit',
            status: a.status || 'booked',
          });
        }
      }
    }

    // fallback from patients' timelines
    for (const p of patients) {
      for (const t of (p.timeline || [])) {
        const ts = Date.parse(t.ts || '');
        if (!isFinite(ts)) continue;
        if (ts > Date.now()) {
          all.push({
            id: `${p.id}-tl-${ts}`,
            patientId: p.id,
            patientName: p.name,
            startsAt: t.ts,
            reason: t.note || 'Televisit',
            status: 'booked',
          });
        }
      }
    }

    return all
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, 5);
  }, [live, patients]);

  // pagination slice
  const paged = useMemo(() => {
    const arr = filtered;
    const s = (page - 1) * pageSize;
    return arr.slice(s, s + pageSize);
  }, [filtered, page]);

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-1">Search, view and manage patients — telehealth-first.</p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:scale-102 transform transition"
            onClick={() => setDrawerOpenState(true)}
          >
            + Create Appointment
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Total Patients" value={total} data={totalSpark} color="#2563eb" />
        <KpiCard title="Upcoming Visits" value={upcoming} data={upcomingSpark} color="#f59e0b" />
        <KpiCard title="Past Visits (7d)" value={pastVisitsCount} data={pastVisitsSpark} color="#6b21a8" />
        <KpiCard title="High Risk" value={highRisk} data={highRiskSpark} color="#ef4444" />
      </div>

      {/* Search & Filters */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input type="text" placeholder="Search name, email, or ID" className="border rounded p-2 text-sm" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <select className="border rounded p-2 text-sm" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}>
          <option value="">Any Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <select className="border rounded p-2 text-sm" value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}>
          <option value="">Any Location</option>
          {Array.from(new Set(patients.map(p => p.location))).map(loc => loc ? <option key={loc} value={loc}>{loc}</option> : null)}
        </select>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded border hover:bg-gray-50 text-sm" onClick={() => { setQuery(''); setGenderFilter(''); setLocationFilter(''); setPage(1); }}>Reset</button>
          <div className="ml-auto text-xs text-gray-500 self-center">Results: <span className="font-medium">{filtered.length}</span></div>
        </div>
      </section>

      {/* Two-column: patient list + upcoming panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Patient list (scrollable, limited height) */}
        <section className="bg-white border rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-6 text-gray-500">No patients found.</div>
          ) : (
            <div style={{ maxHeight: 560, overflow: 'auto' }}>
              {paged.map((p) => {
                const lastSeen = p.lastSeen ? new Date(p.lastSeen) : null;
                const isActiveRecently = lastSeen ? (Date.now() - lastSeen.getTime()) < 1000 * 60 * 60 * 24 * 7 : false;
                const riskClass = p.risk === 'high' ? 'bg-rose-100 text-rose-700' : p.risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700';

                // past visits per patient
                const pastVisitsForPatient = (p.timeline || []).filter(t => {
                  const ts = Date.parse(t.ts || '');
                  if (!isFinite(ts)) return false;
                  return ts < Date.now() && (t.type === 'completed' || t.type === 'appointment' || t.type === 'visit');
                }).length;

                // does patient have an upcoming appointment?
                const hasUpcoming = (p.timeline || []).some(t => {
                  const ts = Date.parse(t.ts || '');
                  if (!isFinite(ts)) return false;
                  return ts > Date.now() && (t.type === 'appointment' || t.type === 'scheduled');
                });

                // upcoming appointment start time (closest)
                const nextApptTs = (p.timeline || [])
                  .map(t => ({ ...t, _ts: Date.parse(t.ts || '') }))
                  .filter(t => isFinite(t._ts) && t._ts > Date.now() && (t.type === 'appointment' || t.type === 'scheduled'))
                  .sort((a, b) => a._ts - b._ts)[0];

                return (
                  <motion.div
                    key={p.id}
                    className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer ${isActiveRecently ? '' : 'opacity-95'}`}
                    onClick={() => { setSelected(p); setDrawerOpenState(true); }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-100 grid place-items-center font-medium text-indigo-700">
                      {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">•</div>
                        <div className="text-xs text-gray-500">{p.id}</div>
                        <div className={`ml-2 px-2 py-0.5 rounded text-xs ${riskClass}`}>{p.risk ?? 'low'}</div>

                        {/* past visits inline */}
                        <div className="ml-2 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                          {pastVisitsForPatient} past
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {p.location ?? '—'} · Last seen: {p.lastSeen ? new Date(p.lastSeen).toLocaleString() : '—'}
                        {nextApptTs && <span className="ml-2 text-xs text-amber-700">• Next: {formatLongDateISO(nextApptTs.ts || nextApptTs._ts)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); createAppointmentFor(p); }}
                      >
                        + Add appt
                      </button>

                      <button
                        className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); alert('Open New Note (demo)'); }}
                      >
                        New Note
                      </button>

                      {/* show Join only if patient has upcoming appointment */}
                      {hasUpcoming && (
                        <button
                          className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                          onClick={(e) => { e.stopPropagation(); window.open('/sfu/room-1001', '_blank'); }}
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right column: Upcoming visits (next 5) */}
        <aside className="hidden lg:block">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Upcoming Visits</h3>
              <div className="text-xs text-gray-400">Next 5</div>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="text-sm text-gray-500">No upcoming visits</div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((a) => (
                  <div key={a.id} className="p-2 border rounded hover:bg-gray-50 transition-colors">
                    <div className="text-sm font-medium truncate">{a.patientName}</div>
                    <div className="text-xs text-gray-500">{formatLongDateISO(a.startsAt)} • {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="px-2 py-1 text-xs rounded bg-indigo-600 text-white"
                        onClick={() => window.open('/sfu/room-1001', '_blank')}
                      >
                        Join
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded border"
                        onClick={() => {
                          // navigate to patient drawer
                          const p = patients.find(pp => pp.id === a.patientId);
                          if (p) {
                            setSelected(p);
                            setDrawerOpenState(true);
                          } else {
                            alert('Patient not found (demo)');
                          }
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">Page {page} / {totalPages}</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <button className="px-2 py-1 border rounded" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>

      {/* drawer/modal create appointment */}
      <CreateAppointmentDrawer
        open={drawerOpenState}
        onClose={() => setDrawerOpenState(false)}
        patients={patients}
        clinicianId={clinicianId}
        onCreated={(a) => {
          const pid = a?.patientId || a?.patient?.id;
          if (pid) {
            setPatients(prev => prev.map(p => p.id === pid ? { ...p, timeline: [...(p.timeline || []), { ts: a.startsAt || new Date().toISOString(), type: 'appointment', note: a.reason || '' }], lastSeen: a.startsAt || new Date().toISOString() } : p));
          }
          setToast({ msg: 'Appointment created (backend)', kind: 'success' });
          refreshKeyBump();
        }}
        refreshKeyBump={refreshKeyBump}
      />

      {/* editable patient drawer */}
      <PatientDrawer
        patient={selected}
        onClose={() => { setSelected(null); setDrawerOpenState(false); }}
        onSave={(p) => { savePatient(p); setSelected(null); setDrawerOpenState(false); }}
        onReschedule={(p, when) => { rescheduleAppointment(p, when); }}
        onCancelAppt={(p) => { cancelAppointment(p); }}
        appointmentsForPatient={selected ? appointmentsForPatient(selected.id) : []}
      />

      {/* toast */}
      {toast && (
        <div className={`fixed right-4 bottom-6 z-50 rounded p-3 shadow-lg ${toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="flex items-center gap-3">
            <div className="text-sm">{toast.msg}</div>
            {toast.undo && <button onClick={() => { toast.undo && toast.undo(); setToast(null); }} className="text-xs underline">Undo</button>}
            <button onClick={() => setToast(null)} className="ml-3 text-xs opacity-80">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
