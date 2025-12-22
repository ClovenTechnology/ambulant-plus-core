// apps/clinician-app/app/today/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Appointment } from '@/lib/types';
import AgendaList from '@/src/components/AgendaList';
import SessionCountdown from '@/src/components/SessionCountdown';
import NoteForm from '@/components/forms/NoteForm';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type PatientAlert = {
  id: string;
  patientName: string;
  type: 'vitals' | 'message' | 'lab' | 'multifactor';
  message: string;
  timestamp: string;
  severity: AlertSeverity;
};

export default function TodayPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const clinicianId = 'clin-demo'; // TODO: derive from auth/session

  // Fetch today's appointments
  useEffect(() => {
    async function fetchAppointments() {
      setLoading(true);
      try {
        const res = await fetch(`/api/_proxy/appointments?clinicianId=${clinicianId}`);
        const data = await res.json();
        setAppointments(data || []);
      } catch (err) {
        console.error('Failed to fetch appointments', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, [clinicianId]);

  // Fetch real InsightCore alerts for this clinician
  useEffect(() => {
    let cancelled = false;

    async function fetchAlerts() {
      try {
        setAlertsError(null);
        const res = await fetch(
          `/api/insightcore/alerts?clinicianId=${encodeURIComponent(clinicianId)}&limit=10`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (cancelled) return;

        const incoming = (data.alerts || []) as any[];

        const mapped: PatientAlert[] = incoming.map((a) => ({
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
          severity: (a.severity as AlertSeverity) || 'moderate',
        }));

        setAlerts(mapped);
      } catch (e: any) {
        if (cancelled) return;
        console.error('Failed to fetch InsightCore alerts', e);
        setAlertsError('Unable to load InsightCore alerts right now.');
      }
    }

    fetchAlerts();
    const timer = setInterval(fetchAlerts, 60_000); // refresh every 60s

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [clinicianId]);

  const nextAppointment = useMemo(() => {
    const upcoming = appointments
      .filter((a) => new Date(a.startsAt) > new Date())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return upcoming[0] ?? null;
  }, [appointments]);

  function severityClass(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'border-red-600 bg-red-50';
      case 'high':
        return 'border-amber-500 bg-amber-50';
      case 'moderate':
        return 'border-yellow-400 bg-yellow-50';
      case 'low':
      default:
        return 'border-sky-300 bg-sky-50';
    }
  }

  function severityLabel(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'moderate':
        return 'Medium';
      case 'low':
      default:
        return 'Low';
    }
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Today&apos;s Agenda</h1>
        <div className="text-sm text-gray-600">
          {appointments.length} appointments scheduled
        </div>
      </header>

      {/* Alerts */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-slate-800">Patient Alerts</h2>
          {alertsError && (
            <span className="text-xs text-rose-600">{alertsError}</span>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="text-xs text-gray-500">
            No InsightCore alerts for you right now.
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`p-3 border rounded text-sm flex flex-col gap-1 ${severityClass(
                  alert.severity,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {alert.patientName}{' '}
                    <span className="text-xs text-gray-600">
                      • {alert.type === 'multifactor' ? 'InsightCore' : alert.type}
                    </span>
                  </div>
                  <span className="text-[11px] rounded-full border border-black/10 px-2 py-0.5">
                    {severityLabel(alert.severity)}
                  </span>
                </div>
                <div className="text-gray-800">{alert.message}</div>
                <time className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        {/* Appointments list */}
        <div>
          <AgendaList
            appointments={appointments}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>

        {/* Right sidebar */}
        <aside className="space-y-6">
          {/* Countdown / next session */}
          <div className="sticky top-6">
            <SessionCountdown
              appointment={selected ?? nextAppointment ?? undefined}
              loading={loading}
            />
          </div>

          {/* Quick actions */}
          {selected && (
            <div className="p-3 border rounded space-y-2 bg-gray-50">
              <h2 className="font-medium text-slate-800">Quick Actions</h2>
              <div className="flex flex-col gap-2">
                <button
                  className="px-3 py-2 bg-indigo-600 text-white rounded"
                  onClick={() =>
                    window.open(`/sfu/room-${selected.id}`, '_blank')
                  }
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

          {/* AI Suggestions placeholder (can later be wired to InsightCore /query) */}
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

      {/* Inline Note Form Modal */}
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
