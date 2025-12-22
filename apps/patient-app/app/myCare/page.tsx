// apps/patient-app/app/myCare/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

import MeterDonut from '@/components/charts/MeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import SleepCard from '@/components/charts/SleepCard';
import BpChart from '@/components/charts/BpChart';
import useLiveVitals from '@/components/charts/useLiveVitals';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import TodaysPills from '@/components/TodaysPills';
import AllergiesPanel from '@/components/AllergiesPanel';
import { exportElementAsPdf } from '@/components/charts/export';
import { useSSE } from '@/hooks/useSSE';

import { CollapseBtn } from '@/components/CollapseBtn';
import { Collapse } from '@/components/Collapse';

import {
  type ApiReminder,
  MOCK_REMINDERS,
  getReminderType,
  computeStats,
} from '@/components/reminders/shared';

/* ---------------------- Local types & mock data ---------------------- */

type MedicationStatus = 'Active' | 'Completed' | 'On Hold';

type Medication = {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  status: MedicationStatus;
  started?: string;
  lastFilled?: string;
  durationDays?: number | null;
  source?: string | null;
  meta?: any;
};

type TodaysPill = {
  id: string;
  name: string;
  dose: string;
  time: string;
  status: 'Pending' | 'Taken' | 'Missed';
};

const initialAllergies = [
  { name: 'Penicillin', status: 'Confirmed', severity: 'High', note: 'Hives when exposed' },
];

const mockMedsForMyCare: Medication[] = [
  {
    id: 'mock-1',
    name: 'Paracetamol',
    dose: '500 mg',
    frequency: '1 tablet every 6 hours',
    status: 'Active',
  },
];

/* ---------------------- Utility helpers ---------------------- */

function nicePercent(n: number) {
  return Math.round(n);
}

/* ---------------------- Page ---------------------- */

export default function MyCareHome() {
  // primary live vitals generator (your component)
  const { data: vitalsSeries, live, setLive, flags } = useLiveVitals(120, 1);

  // small SSE hook usage (keeps parity if server yields other events)
  const { connected, on } = useSSE('/api/iomt/stream');

  // allergies still mocked locally (can be wired to /api/profile later)
  const [allergies, setAllergies] = useState(initialAllergies);

  // Medications quick view
  const [meds, setMeds] = useState<Medication[]>([]);
  const [medsLoading, setMedsLoading] = useState(false);
  const [medsError, setMedsError] = useState<string | null>(null);

  // Reminders (shared with /reminder semantics)
  const [apiReminders, setApiReminders] = useState<ApiReminder[]>([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [usedMockReminders, setUsedMockReminders] = useState(false);

  // collapse states for panes
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [vitalsOpen, setVitalsOpen] = useState(true);
  const [bpOpen, setBpOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);

  const [pillsOpen, setPillsOpen] = useState(true);
  const [remindersOpen, setRemindersOpen] = useState(true);
  const [sleepOpen, setSleepOpen] = useState(true);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const [allergiesOpen, setAllergiesOpen] = useState(true);

  // consecutive alert counters to avoid one-off noise (3 consecutive policy)
  const alertCountersRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const map: Record<string, boolean> = {
      HR_HIGH: flags.HR_HIGH ?? false,
      HR_LOW: flags.HR_LOW ?? false,
      BP_HIGH: flags.BP_HIGH ?? false,
      TEMP_HIGH: flags.TEMP_HIGH ?? false,
      GLU_HIGH: flags.GLU_HIGH ?? false,
    };

    for (const key of Object.keys(map)) {
      if (map[key]) {
        alertCountersRef.current[key] = (alertCountersRef.current[key] || 0) + 1;
      } else {
        alertCountersRef.current[key] = 0;
      }

      if (alertCountersRef.current[key] >= 3) {
        if (alertCountersRef.current[`${key}_fired`]) continue;
        alertCountersRef.current[`${key}_fired`] = 1;

        switch (key) {
          case 'HR_HIGH':
            toast.error(
              'Sustained high heart rate detected — consider resting or booking a teleconsult.'
            );
            break;
          case 'HR_LOW':
            toast.error(
              'Low heart rate trend detected — consider contacting clinician if symptomatic.'
            );
            break;
          case 'BP_HIGH':
            toast('Elevated blood pressure sustained — would you like to start a teleconsult?', {
              duration: 8000,
              action: {
                label: 'Start eVisit',
                onClick: () => window.alert('Simulated: start teleconsult flow'),
              },
            } as any);
            break;
          case 'TEMP_HIGH':
            toast('Elevated temperature detected — monitor for symptoms and consider testing.');
            break;
          case 'GLU_HIGH':
            toast('High glucose trend — open dietary guidance or schedule a diabetes review.', {
              duration: 7000,
            });
            break;
          default:
            break;
        }
      } else {
        if (alertCountersRef.current[key] === 0)
          alertCountersRef.current[`${key}_fired`] = 0;
      }
    }
  }, [flags]);

  // basic SSE forwarding to local generator
  useEffect(() => {
    const unsub = on('message', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.type === 'vitals') {
          try {
            window.postMessage(payload, '*');
          } catch {}
        }
      } catch {}
    });
    return () => unsub();
  }, [on]);

  /* ---------------------- Load Medications ---------------------- */

  useEffect(() => {
    (async () => {
      setMedsLoading(true);
      setMedsError(null);
      try {
        const res = await fetch('/api/medications', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load medications');
        const data = await res.json();
        const list: Medication[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any).items)
          ? (data as any).items
          : [];
        setMeds(list);
      } catch (err: any) {
        console.error('[myCare] Error loading medications:', err);
        setMedsError(err?.message || 'Could not load medications; showing a sample.');
        setMeds(mockMedsForMyCare);
      } finally {
        setMedsLoading(false);
      }
    })();
  }, []);

  const medsStats = useMemo(() => {
    if (!meds.length) {
      return { total: 0, active: 0, completed: 0, onHold: 0 };
    }
    const active = meds.filter((m) => m.status === 'Active').length;
    const completed = meds.filter((m) => m.status === 'Completed').length;
    const onHold = meds.filter((m) => m.status === 'On Hold').length;
    return { total: meds.length, active, completed, onHold };
  }, [meds]);

  /* ---------------------- Load Reminders (shared with /reminder) ---------------------- */

  async function reloadReminders() {
    setReminderLoading(true);
    setReminderError(null);
    setUsedMockReminders(false);
    try {
      const res = await fetch('/api/reminders?for=today', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load reminders');
      const data = await res.json();
      const list: ApiReminder[] = Array.isArray((data as any).reminders)
        ? (data as any).reminders
        : Array.isArray(data)
        ? (data as any)
        : [];

      const effective = list.length ? list : MOCK_REMINDERS;
      if (!list.length) setUsedMockReminders(true);

      setApiReminders(effective);
    } catch (err: any) {
      console.error('[myCare] Error loading reminders:', err);
      setReminderError(err?.message || 'Could not load reminders; showing a sample.');
      setApiReminders(MOCK_REMINDERS);
      setUsedMockReminders(true);
    } finally {
      setReminderLoading(false);
    }
  }

  useEffect(() => {
    reloadReminders();
  }, []);

  const pillReminders = useMemo(
    () => apiReminders.filter((r) => getReminderType(r) === 'pill'),
    [apiReminders]
  );

  const todaysPills: TodaysPill[] = useMemo(
    () =>
      pillReminders
        .filter((r) => r.status === 'Pending')
        .map((r) => ({
          id: r.id,
          name: r.name,
          dose: r.dose ?? '',
          time: r.time ?? r.meta?.displayTime ?? '',
          status: r.status as 'Pending' | 'Taken' | 'Missed',
        }))
        .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [pillReminders]
  );

  const reminderListItems: ReminderShape[] = useMemo(
    () =>
      apiReminders.map((r) => {
        const type = getReminderType(r);
        const baseTitle = r.name || 'Reminder';
        return {
          id: r.id,
          type,
          title: baseTitle,
          dueTime: r.time || r.meta?.displayTime,
          completed: r.status === 'Taken',
          dose: r.dose ?? undefined,
          status: r.status,
          erxId: r.meta?.erxId ?? null,
          notes: r.meta?.notes,
          recurrence: r.meta?.recurrence,
          meta: { ...r.meta, displayTime: r.time ?? r.meta?.displayTime },
        };
      }),
    [apiReminders]
  );

  const overallReminderStats = useMemo(
    () => computeStats(apiReminders),
    [apiReminders]
  );

  const reminderCompletionPct = useMemo(() => {
    const total =
      overallReminderStats.pending +
      overallReminderStats.taken +
      overallReminderStats.missed;
    if (total === 0) return 0;
    return Math.round((overallReminderStats.taken / total) * 100);
  }, [overallReminderStats]);

  const pillStats = useMemo(
    () => computeStats(pillReminders),
    [pillReminders]
  );

  /* ---------------------- Reminder actions (confirm / snooze) ---------------------- */

  const handleConfirmReminder = async (rem: ReminderShape) => {
    if (!rem.id) return;

    // optimistic UI
    setApiReminders((prev) =>
      prev.map((r) =>
        r.id === rem.id ? { ...r, status: 'Taken', snoozedUntil: null } : r
      )
    );

    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          id: rem.id,
          takenAt: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && (data as any).ok === false)) {
        console.error('[myCare] confirm reminder failed', data);
        toast.error('Could not sync this reminder; will retry next time.');
      }
    } catch (err) {
      console.error('[myCare] Error confirming reminder', err);
      toast.error('Network error while confirming reminder.');
    }
  };

  const handleSnoozeReminder = async (rem: ReminderShape, mins = 10) => {
    if (!rem.id) return;

    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'snooze',
          id: rem.id,
          snoozeMinutes: mins,
        }),
      });
      const data = await res.json().catch(() => null);

      // Newer shape: results map
      const updatedFromMap =
        (data as any)?.results &&
        (data as any).results[rem.id] &&
        (data as any).results[rem.id].reminder;

      const updated = updatedFromMap || (data as any)?.reminder || null;

      if (updated) {
        setApiReminders((prev) =>
          prev.map((r) => (r.id === rem.id ? (updated as ApiReminder) : r))
        );
      } else if (!res.ok) {
        toast.error('Could not snooze this reminder.');
      }
    } catch (err) {
      console.error('[myCare] Error snoozing reminder', err);
      toast.error('Network error while snoozing reminder.');
    }
  };

  /* ---------------------- quick gauges ---------------------- */

  const latest = vitalsSeries.latest ?? {};
  const hr = latest.hr ?? 0;
  const spo2 = latest.spo2 ?? 0;
  const tempC = latest.temp ?? 0;
  const sys = latest.sys ?? 0;
  const dia = latest.dia ?? 0;
  const glucoseVal = latest.glucose ?? 0;

  /* ---------------------- goal / gamification (simple) ---------------------- */
  const goals = useMemo(
    () => [
      {
        title: 'Steps',
        current: Math.round(vitalsSeries.latest.steps ?? 0),
        target: 10000,
        unit: 'steps',
        streak: 3,
      },
      {
        title: 'Sleep',
        current: Math.round(vitalsSeries.sleep.totalHours ?? 0),
        target: 8,
        unit: 'h',
        streak: 2,
      },
      { title: 'Hydration', current: 1.3, target: 2, unit: 'L', streak: 1 },
    ],
    [vitalsSeries]
  );

  /* ---------------------- export dashboard summary ---------------------- */
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const onExportPdf = async () => {
    if (!summaryRef.current) return;
    try {
      await exportElementAsPdf(summaryRef.current, 'mycare-summary.pdf');
      toast.success('Exported PDF');
    } catch {
      toast.error('Export failed');
    }
  };

  /* ---------------------- UI ---------------------- */
  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">myCare — Personal Health Suite</h1>
          <div className="text-sm text-gray-500 mt-1">
            Live IoMT feeds • Medications & reminders • Goals & insights
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {medsLoading
              ? 'Loading your medication list...'
              : medsStats.active
              ? `${medsStats.active} active medication${medsStats.active === 1 ? '' : 's'} · ${nicePercent(
                  pillStats.pct
                )}% pill adherence today`
              : 'No active medications captured yet'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`text-xs px-3 py-1 rounded-full ${
              connected
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {connected ? 'SSE Live' : 'Offline'}
          </div>
          <button
            onClick={() => setLive((s) => !s)}
            className="px-3 py-1 rounded bg-slate-800 text-white text-sm"
          >
            {live ? 'Pause Live' : 'Resume Live'}
          </button>
          <button onClick={onExportPdf} className="px-3 py-1 rounded border text-sm">
            Export summary
          </button>
          <Link href="/medications" className="underline text-sm">
            Medications
          </Link>
          <Link href="/reminder" className="underline text-sm">
            Reminders
          </Link>
          <Link href="/myCare/devices" className="underline text-sm">
            Devices
          </Link>
        </div>
      </header>

      {/* ---------- Middle grid: Left = Insights + Vitals, Right = Meds/Pills/Reminders/Sleep/Goals/Allergies ---------- */}
      <section ref={summaryRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ========== LEFT: Insights + Vitals & charts ========== */}
        <div className="col-span-2 space-y-4">
          {/* Insights at top (collapsible) */}
          <div className="rounded-2xl border p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Personalized Insights</div>
                <div className="font-medium">AI Assistance</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">Updated live</div>
                <CollapseBtn open={insightsOpen} onClick={() => setInsightsOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={insightsOpen}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  className={`rounded-lg p-3 ${
                    flags.BP_HIGH ? 'bg-rose-50' : 'bg-emerald-50'
                  }`}
                >
                  <div className="text-xs text-gray-600">Blood Pressure</div>
                  <div className="font-medium">
                    {flags.BP_HIGH ? 'Action recommended' : `${sys}/${dia} mmHg`}
                  </div>
                  {flags.BP_HIGH ? (
                    <div className="text-xs text-rose-600 mt-1">
                      Sustained elevation — consider teleconsult
                    </div>
                  ) : null}
                </div>

                <div
                  className={`rounded-lg p-3 ${
                    flags.HR_HIGH ? 'bg-rose-50' : 'bg-amber-50'
                  }`}
                >
                  <div className="text-xs text-gray-600">Heart Rate</div>
                  <div className="font-medium">{hr} bpm</div>
                  {flags.HR_HIGH ? (
                    <div className="text-xs text-rose-600 mt-1">
                      High heart rate detected
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">Normal</div>
                  )}
                </div>

                <div className="rounded-lg p-3 bg-white">
                  <div className="text-xs text-gray-600">Glucose</div>
                  <div className="font-medium">{glucoseVal} mg/dL</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {flags.GLU_HIGH ? 'Trend high — dietary review' : 'Stable'}
                  </div>
                </div>
              </div>
            </Collapse>
          </div>

          {/* Quick vitals (collapsible) */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Live Vitals</div>
                <div className="font-medium">Real-time IoMT feeds</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">Updated every sec</div>
                <CollapseBtn open={vitalsOpen} onClick={() => setVitalsOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={vitalsOpen}>
              <div className="grid grid-cols-3 gap-4">
                <MeterDonut value={hr} max={180} label="Heart rate (bpm)" color="#ef4444" unit="" />
                <MeterDonut
                  value={spo2}
                  max={100}
                  label="SpO₂ (%)"
                  color="#06b6d4"
                  unit="%"
                />
                <MeterDonut
                  value={tempC}
                  max={42}
                  label="Body temp (°C)"
                  color="#f97316"
                  unit="°C"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="rounded-2xl border bg-white p-3">
                  <div className="text-xs text-gray-400">Heart rate trend</div>
                  <div className="mt-2">
                    <Sparkline
                      labels={vitalsSeries.labels}
                      values={vitalsSeries.hr.map((p) => p.v)}
                      color="#ef4444"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-3">
                  <div className="text-xs text-gray-400">SpO₂ trend</div>
                  <div className="mt-2">
                    <Sparkline
                      labels={vitalsSeries.labels}
                      values={vitalsSeries.spo2.map((p) => p.v)}
                      color="#06b6d4"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-3">
                  <div className="text-xs text-gray-400">Glucose</div>
                  <div className="mt-2">
                    <Sparkline
                      labels={vitalsSeries.labels}
                      values={vitalsSeries.glucose.map((p) => p.v)}
                      color="#f59e0b"
                    />
                  </div>
                </div>
              </div>
            </Collapse>
          </div>

          {/* BP chart (collapsible) */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Cardio</div>
                <div className="font-medium">Blood Pressure</div>
                <div className="text-xs text-gray-400">SYS / DIA · Hover to inspect</div>
              </div>
              <div className="flex items-center gap-2">
                <CollapseBtn open={bpOpen} onClick={() => setBpOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={bpOpen}>
              <BpChart
                data={vitalsSeries.sys.map((s, i) => ({
                  ts: s.t,
                  sys: s.v,
                  dia: vitalsSeries.dia[i]?.v ?? 0,
                }))}
              />
            </Collapse>
          </div>

          {/* Reports & Exports (collapsible) */}
          <div className="rounded-2xl border p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-500">Reports & Exports</div>
                <div className="font-medium">Share or download</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">Utility</div>
                <CollapseBtn open={reportsOpen} onClick={() => setReportsOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={reportsOpen}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded border text-sm">
                  <div className="font-medium">Latest Vitals</div>
                  <div className="text-xs text-gray-500">
                    HR {hr} • SpO₂ {spo2}% • Temp {tempC}°C
                  </div>
                </div>
                <div className="p-3 rounded border text-sm">
                  <div className="font-medium">Recent Activity</div>
                  <div className="text-xs text-gray-500">
                    Steps ~{Math.round(vitalsSeries.latest.steps ?? 0)}
                  </div>
                </div>
                <div className="p-3 rounded border text-sm">
                  <div className="font-medium">Telehealth</div>
                  <div className="text-xs text-gray-500">
                    Quick actions: Start eVisit • Share summary
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => window.alert('Starting simulated eVisit...')}
                      className="px-2 py-1 rounded bg-sky-600 text-white text-xs"
                    >
                      Start eVisit
                    </button>
                    <button
                      onClick={() => window.alert('Share summary flow...')}
                      className="px-2 py-1 rounded border text-xs"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onExportPdf()}
                  className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Print
                </button>
              </div>
            </Collapse>
          </div>
        </div>

        {/* ========== RIGHT: Meds & Today's Pills -> Reminders -> Sleep -> Goals -> Allergies ========== */}
        <aside className="space-y-4">
          {/* Medications & Today's Pills */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Medications & today&apos;s pills</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">
                  {medsLoading
                    ? 'Loading...'
                    : medsStats.active
                    ? `${medsStats.active} active`
                    : 'No active meds'}
                </div>
                <CollapseBtn open={pillsOpen} onClick={() => setPillsOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={pillsOpen}>
              {medsError && (
                <div className="mb-2 text-xs text-amber-700">{medsError}</div>
              )}

              {medsStats.active > 0 && (
                <div className="mb-2 text-xs text-gray-500">
                  {medsStats.completed} completed · {medsStats.onHold} on hold
                </div>
              )}

              <TodaysPills
                pills={todaysPills}
                onAdherenceUpdate={(pct) =>
                  toast(`Pill adherence today: ${pct}%`, { icon: '💊' })
                }
              />

              <p className="mt-2 text-xs text-gray-500">
                Manage your full list in{' '}
                <Link
                  href="/medications"
                  className="text-emerald-700 underline underline-offset-2"
                >
                  Medications
                </Link>
                .
              </p>
            </Collapse>
          </div>

          {/* Reminders (second) */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Reminders</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">
                  {reminderLoading
                    ? 'Loading...'
                    : `${reminderCompletionPct}% done today`}
                </div>
                <CollapseBtn
                  open={remindersOpen}
                  onClick={() => setRemindersOpen((s) => !s)}
                />
              </div>
            </div>

            <Collapse open={remindersOpen}>
              {reminderError && (
                <div className="mb-2 text-xs text-amber-700">{reminderError}</div>
              )}
              {usedMockReminders && (
                <div className="mb-2 text-[11px] text-gray-500">
                  Showing sample reminders while we reconnect to the server.
                </div>
              )}
              {reminderListItems.length === 0 && !reminderLoading ? (
                <div className="text-xs text-gray-500">
                  No reminders for today yet. You can create pill reminders from{' '}
                  <Link
                    href="/medications"
                    className="text-emerald-700 underline underline-offset-2"
                  >
                    Medications
                  </Link>{' '}
                  or add lifestyle nudges from{' '}
                  <Link
                    href="/reminder"
                    className="text-emerald-700 underline underline-offset-2"
                  >
                    Reminders
                  </Link>
                  .
                </div>
              ) : (
                <ReminderList
                  reminders={reminderListItems}
                  onConfirm={handleConfirmReminder}
                  onSnooze={handleSnoozeReminder}
                  onSyncErx={async () => {
                    // optional in this compact view – defer to Medications / Reminders pages
                    toast('Open Medications or Reminders to manage scripts.', {
                      icon: 'ℹ️',
                    });
                  }}
                />
              )}

              <button
                onClick={reloadReminders}
                className="mt-2 text-[11px] text-gray-500 underline"
              >
                Refresh reminders
              </button>
            </Collapse>
          </div>

          {/* Sleep (third) */}
          <div className="rounded-2xl border p-3 bg-[#071029]/60 sci-glow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Sleep (NexRing)</div>
                <div className="font-medium text-white">Last night</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-400">
                  Updated{' '}
                  {new Date(vitalsSeries.sleep.updatedAt).toLocaleTimeString()}
                </div>
                <CollapseBtn open={sleepOpen} onClick={() => setSleepOpen((s) => !s)} />
              </div>
            </div>

            <Collapse open={sleepOpen}>
              <div className="mt-3">
                <SleepCard sleep={vitalsSeries.sleep} />
              </div>
            </Collapse>
          </div>

          {/* Goals (fourth) */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Goals</div>
              <div className="text-xs text-gray-400">Daily progress</div>
              <CollapseBtn open={goalsOpen} onClick={() => setGoalsOpen((s) => !s)} />
            </div>

            <Collapse open={goalsOpen}>
              <div className="mt-3 space-y-2">
                {goals.map((g) => (
                  <div key={g.title} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{g.title}</div>
                      <div className="text-xs text-gray-400">
                        {g.current}/{g.target} {g.unit}
                      </div>
                    </div>
                    <div className="w-20">
                      <MeterDonut value={g.current} max={g.target} label="" color="#6366f1" unit="" />
                    </div>
                  </div>
                ))}
              </div>
            </Collapse>
          </div>

          {/* Allergies (bottom) */}
          <div className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Allergies</div>
              <div className="text-xs text-gray-400">Records</div>
              <CollapseBtn
                open={allergiesOpen}
                onClick={() => setAllergiesOpen((s) => !s)}
              />
            </div>

            <Collapse open={allergiesOpen}>
              <AllergiesPanel
                allergies={allergies}
                onRefresh={() => toast('Refreshing allergies...')}
                onExport={() => toast('Exporting allergies...')}
              />
            </Collapse>
          </div>
        </aside>
      </section>
    </main>
  );
}
