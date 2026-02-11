// apps/clinician-app/app/today/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Appointment } from '@/lib/types';
import AgendaList from '@/src/components/AgendaList';
import SessionCountdown from '@/src/components/SessionCountdown';
import NoteForm from '@/components/forms/NoteForm';
import { getClinicianAlerts } from '@/lib/insightcore-client';
import clsx from 'clsx';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type PatientAlert = {
  id: string;
  patientName: string;
  type: 'vitals' | 'message' | 'lab' | 'multifactor';
  message: string;
  timestamp: string;
  severity: AlertSeverity;
  confidence: number; // 0-1 confidence for gradient
  trend?: number[];   // sparkline data
};

/* ---------------- SPARKLINE COMPONENT ---------------- */

function Sparkline({
  data,
  severity,
}: {
  data: number[];
  severity: AlertSeverity;
}) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const color =
    severity === 'critical'
      ? '#dc2626'
      : severity === 'high'
      ? '#f59e0b'
      : severity === 'moderate'
      ? '#eab308'
      : '#0ea5e9';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-8 mt-1">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ----------------------------------------------------- */

export default function TodayPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const clinicianId = 'clin-demo';

  // Fetch appointments
  useEffect(() => {
    async function fetchAppointments() {
      setLoading(true);
      try {
        const res = await fetch(`/api/_proxy/appointments?clinicianId=${clinicianId}`);
        const data = await res.json();
        setAppointments(
          data?.length
            ? data
            : [
                {
                  id: 'mock-1',
                  patientName: 'Jane Doe',
                  startsAt: new Date().toISOString(),
                  endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                },
                {
                  id: 'mock-2',
                  patientName: 'John Smith',
                  startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
                },
              ],
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, [clinicianId]);

  // Fetch InsightCore alerts
  useEffect(() => {
    let cancelled = false;

    function genTrend() {
      return Array.from({ length: 18 }, () => Math.floor(40 + Math.random() * 60));
    }

    async function loadAlerts() {
      try {
        setAlertsError(null);
        const data = await getClinicianAlerts(clinicianId);
        if (cancelled) return;

        const mapped: PatientAlert[] = (data.alerts || []).map((a: any) => ({
          id: String(a.id || crypto.randomUUID()),
          patientName: a.patientName || 'Unknown patient',
          type:
            a.type === 'lab'
              ? 'lab'
              : a.type === 'message'
              ? 'message'
              : a.type === 'vitals'
              ? 'vitals'
              : 'multifactor',
          message: a.title || a.message || 'InsightCore alert',
          timestamp: a.ts || new Date().toISOString(),
          severity: a.severity || 'moderate',
          confidence: a.confidence ?? Math.random(),
          trend: a.trend ?? genTrend(), // 🔥 sparkline data
        }));

        setAlerts(
          mapped.length
            ? mapped
            : [
                {
                  id: 'mock-alert-1',
                  patientName: 'Jane Doe',
                  type: 'vitals',
                  message: 'Heart rate elevated',
                  timestamp: new Date().toISOString(),
                  severity: 'high',
                  confidence: 0.85,
                  trend: genTrend(),
                },
                {
                  id: 'mock-alert-2',
                  patientName: 'John Smith',
                  type: 'multifactor',
                  message: 'Missed lab results',
                  timestamp: new Date().toISOString(),
                  severity: 'moderate',
                  confidence: 0.45,
                  trend: genTrend(),
                },
              ],
        );
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setAlertsError('Unable to load InsightCore alerts.');
        }
      }
    }

    loadAlerts();
    const interval = setInterval(loadAlerts, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clinicianId]);

  const nextAppointment = useMemo(() => {
    return (
      appointments
        .filter((a) => new Date(a.startsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ||
      null
    );
  }, [appointments]);

  function severityClass(severity: AlertSeverity) {
    switch (severity) {
      case 'critical':
        return 'border-red-600 bg-red-50';
      case 'high':
        return 'border-amber-500 bg-amber-50';
      case 'moderate':
        return 'border-yellow-400 bg-yellow-50';
      case 'low':
        return 'border-sky-300 bg-sky-50';
    }
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Today's Agenda</h1>
        <div className="text-sm text-gray-600">{appointments.length} appointments scheduled</div>
      </header>

      {/* Alerts */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-slate-800">Patient Alerts</h2>
          {alertsError && <span className="text-xs text-rose-600">{alertsError}</span>}
        </div>

        {alerts.length === 0 ? (
          <div className="text-xs text-gray-500">No InsightCore alerts for you right now.</div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={clsx(
                  'p-3 border rounded text-sm flex flex-col gap-2 relative overflow-hidden',
                  severityClass(alert.severity),
                )}
              >
                {/* Vertical severity strip */}
                <div
                  className={clsx(
                    'absolute top-0 left-0 h-full w-1 rounded-l',
                    alert.severity === 'critical'
                      ? 'bg-red-600'
                      : alert.severity === 'high'
                      ? 'bg-amber-500'
                      : alert.severity === 'moderate'
                      ? 'bg-yellow-400'
                      : 'bg-sky-400',
                  )}
                ></div>

                {/* Header row */}
                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="font-medium">
                    {alert.patientName}{' '}
                    <span className="text-xs text-gray-600">
                      • {alert.type === 'multifactor' ? 'InsightCore' : alert.type}
                    </span>
                  </div>

                  {/* Pulsing dot */}
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full animate-pulse',
                      alert.severity === 'critical'
                        ? 'bg-red-600'
                        : alert.severity === 'high'
                        ? 'bg-amber-500'
                        : alert.severity === 'moderate'
                        ? 'bg-yellow-400'
                        : 'bg-sky-400',
                    )}
                  ></span>
                </div>

                {/* Message */}
                <div className="text-gray-800 relative z-10">{alert.message}</div>

                {/* Sparkline */}
                <div className="relative z-10">
                  <Sparkline data={alert.trend || []} severity={alert.severity} />
                </div>

                {/* Timestamp */}
                <time className="text-xs text-gray-500 relative z-10">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </time>

                {/* Confidence bar */}
                <div className="h-1 w-full rounded bg-gray-200 mt-1 relative z-10 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded transition-all duration-500',
                      alert.severity === 'critical'
                        ? 'bg-red-600'
                        : alert.severity === 'high'
                        ? 'bg-amber-500'
                        : alert.severity === 'moderate'
                        ? 'bg-yellow-400'
                        : 'bg-sky-400',
                    )}
                    style={{ width: `${Math.floor(alert.confidence * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div>
          <AgendaList
            appointments={appointments}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>

        <aside className="space-y-6">
          <div className="sticky top-6">
            <SessionCountdown appointment={selected ?? nextAppointment ?? undefined} loading={loading} />
          </div>

          {selected && (
            <div className="p-3 border rounded space-y-2 bg-gray-50">
              <h2 className="font-medium text-slate-800">Quick Actions</h2>
              <div className="flex flex-col gap-2">
                <button
                  className="px-3 py-2 bg-indigo-600 text-white rounded"
                  onClick={() => window.open(`/sfu/room-${selected.id}`, '_blank')}
                >
                  Join Televisit
                </button>
                <button
                  className="px-3 py-2 bg-white border rounded"
                  onClick={() => setShowNoteForm(true)}
                >
                  Add Note
                </button>
              </div>
            </div>
          )}

          <div className="p-3 border rounded bg-gray-50">
            <h2 className="font-medium text-slate-800">AI Suggestions</h2>
            <ul className="text-sm list-disc list-inside text-gray-700">
              <li>Review patients with critical InsightCore alerts.</li>
              <li>Prioritise follow-ups for uncontrolled blood pressure.</li>
              <li>Check adherence for high-risk chronic patients.</li>
            </ul>
          </div>
        </aside>
      </div>

      {showNoteForm && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-lg max-w-3xl w-full p-4 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-900"
              onClick={() => setShowNoteForm(false)}
            >
              ✕
            </button>
            <NoteForm clinicianId={clinicianId} onSaved={() => setShowNoteForm(false)} />
          </div>
        </div>
      )}
    </main>
  );
}
