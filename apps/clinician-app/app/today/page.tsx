// apps/clinician-app/app/today/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { Appointment } from '@/lib/types';
import AgendaList from '@/src/components/AgendaList';
import SessionCountdown from '@/src/components/SessionCountdown';
import NoteForm from '@/components/forms/NoteForm';
import { getClinicianAlerts } from '@/lib/insightcore-client';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type PatientAlert = {
  id: string;
  patientName: string;
  type: 'vitals' | 'message' | 'lab' | 'multifactor';
  message: string;
  timestamp: string;
  severity: AlertSeverity;
  confidence: number;
  trend?: number[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isAlertSeverity(value: unknown): value is AlertSeverity {
  return (
    value === 'low' ||
    value === 'moderate' ||
    value === 'high' ||
    value === 'critical'
  );
}

function normaliseAlertType(value: unknown): PatientAlert['type'] {
  if (
    value === 'vitals' ||
    value === 'message' ||
    value === 'lab' ||
    value === 'multifactor'
  ) {
    return value;
  }

  return 'multifactor';
}

function normaliseConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(1, value));
}

function getSeverityClass(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-red-600 bg-red-50';
    case 'high':
      return 'border-amber-500 bg-amber-50';
    case 'moderate':
      return 'border-yellow-400 bg-yellow-50';
    case 'low':
      return 'border-sky-300 bg-sky-50';
    default:
      return 'border-sky-300 bg-sky-50';
  }
}

function buildLobbyHrefForAppointment(a: any) {
  const roomId = a?.roomId || a?.roomName || (a?.id ? 'room-' + a.id : '');
  const sp = new URLSearchParams();

  if (roomId) sp.set('roomId', roomId);
  if (a?.id) sp.set('appointmentId', a.id);
  if (a?.encounterId) sp.set('encounterId', a.encounterId);
  if (a?.visitId || a?.televisitId) sp.set('visitId', String(a.visitId || a.televisitId));

  const clinicianId = a?.clinician?.id || a?.clinicianId || '';
  if (clinicianId) sp.set('clinicianId', clinicianId);

  const clinicianName = a?.clinician?.name || a?.clinicianName || '';
  if (clinicianName) sp.set('clinicianName', clinicianName);

  const patientId = a?.patient?.id || a?.patientId || '';
  if (patientId) sp.set('patientId', patientId);

  const patientName = a?.patient?.name || a?.patientName || '';
  if (patientName) sp.set('patientName', patientName);

  if (a?.clinicianParticipantId) sp.set('participantId', a.clinicianParticipantId);
  if (a?.patientParticipantId) sp.set('patientParticipantId', a.patientParticipantId);
  if (a?.patientJoinUrl) sp.set('patientJoinUrl', a.patientJoinUrl);
  if (a?.clinicianJoinUrl) sp.set('clinicianJoinUrl', a.clinicianJoinUrl);

  return '/lobby?' + sp.toString();
}

function getSeverityAccentClass(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-600';
    case 'high':
      return 'bg-amber-500';
    case 'moderate':
      return 'bg-yellow-400';
    case 'low':
      return 'bg-sky-400';
    default:
      return 'bg-sky-400';
  }
}

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

export default function TodayPage() {
  const [clinicianId, setClinicianId] = useState<string | null>(null);
  const [clinicianName, setClinicianName] = useState<string | null>(null);
  const [clinicianLoading, setClinicianLoading] = useState(true);
  const [clinicianError, setClinicianError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClinician() {
      setClinicianLoading(true);
      setClinicianError(null);

      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !data?.ok || !data?.clinicianId) {
          throw new Error(data?.error || 'Unable to resolve clinician profile.');
        }

        const resolvedClinicianId = String(data.clinicianId);

        if (resolvedClinicianId === 'clin-demo') {
          throw new Error(
            'Production clinician context is not configured. /api/me returned clin-demo.'
          );
        }

        setClinicianId(resolvedClinicianId);
        setClinicianName(
          data.name ? String(data.name) : data.clinician?.displayName ?? null
        );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setClinicianId(null);
          setClinicianName(null);
          setClinicianError(
            err instanceof Error
              ? err.message
              : 'Unable to resolve clinician profile.'
          );
        }
      } finally {
        if (!cancelled) {
          setClinicianLoading(false);
        }
      }
    }

    loadClinician();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clinicianId) {
      setAlerts([]);
      return;
    }

    const activeClinicianId = clinicianId;
    let cancelled = false;

    async function loadAlerts() {
      try {
        setAlertsError(null);

        const data = await getClinicianAlerts(activeClinicianId);

        if (cancelled) return;

        const rawAlerts = Array.isArray(data?.alerts) ? data.alerts : [];

        const mapped: PatientAlert[] = rawAlerts.map((a: any) => ({
          id: String(a.id || crypto.randomUUID()),
          patientName: String(a.patientName || 'Unknown patient'),
          type: normaliseAlertType(a.type),
          message: String(a.title || a.message || 'InsightCore alert'),
          timestamp: String(a.ts || a.timestamp || new Date().toISOString()),
          severity: isAlertSeverity(a.severity) ? a.severity : 'moderate',
          confidence: normaliseConfidence(a.confidence),
          trend: Array.isArray(a.trend)
            ? a.trend.filter((point: unknown): point is number => {
                return typeof point === 'number' && Number.isFinite(point);
              })
            : undefined,
        }));

        setAlerts(mapped);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setAlerts([]);
          setAlertsError('Unable to load InsightCore alerts.');
        }
      }
    }

    loadAlerts();

    const interval = window.setInterval(loadAlerts, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clinicianId]);

  if (clinicianLoading) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          Loading clinician context…
        </div>
      </main>
    );
  }

  if (!clinicianId || clinicianError) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-lg font-semibold text-rose-800">
            Clinician context unavailable
          </h1>
          <p className="mt-1 text-sm text-rose-700">
            {clinicianError || 'Unable to load clinician profile.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Today's Agenda
          </h1>

          {clinicianName && (
            <p className="text-xs text-gray-500 mt-1">{clinicianName}</p>
          )}
        </div>
      </header>

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
                className={cx(
                  'p-3 border rounded text-sm flex flex-col gap-2 relative overflow-hidden',
                  getSeverityClass(alert.severity)
                )}
              >
                <div
                  className={cx(
                    'absolute top-0 left-0 h-full w-1 rounded-l',
                    getSeverityAccentClass(alert.severity)
                  )}
                />

                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="font-medium">
                    {alert.patientName}{' '}
                    <span className="text-xs text-gray-600">
                      •{' '}
                      {alert.type === 'multifactor'
                        ? 'InsightCore'
                        : alert.type}
                    </span>
                  </div>

                  <span
                    className={cx(
                      'w-2 h-2 rounded-full animate-pulse',
                      getSeverityAccentClass(alert.severity)
                    )}
                  />
                </div>

                <div className="text-gray-800 relative z-10">
                  {alert.message}
                </div>

                {alert.trend && alert.trend.length > 1 && (
                  <div className="relative z-10">
                    <Sparkline data={alert.trend} severity={alert.severity} />
                  </div>
                )}

                <time className="text-xs text-gray-500 relative z-10">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </time>

                <div className="h-1 w-full rounded bg-gray-200 mt-1 relative z-10 overflow-hidden">
                  <div
                    className={cx(
                      'h-full rounded transition-all duration-500',
                      getSeverityAccentClass(alert.severity)
                    )}
                    style={{
                      width: `${Math.floor(alert.confidence * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div>
          <AgendaList
            clinicianId={clinicianId}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>

        <aside className="space-y-6">
          <div className="sticky top-6">
            <SessionCountdown appointment={selected ?? undefined} />
          </div>

          {selected && (
            <div className="p-3 border rounded space-y-2 bg-gray-50">
              <h2 className="font-medium text-slate-800">Quick Actions</h2>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="px-3 py-2 bg-indigo-600 text-white rounded"
                  onClick={() =>
                    window.open(buildLobbyHrefForAppointment(selected as any), '_blank')
                  }
                >
                  Join Televisit
                </button>

                <button
                  type="button"
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
              type="button"
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-900"
              onClick={() => setShowNoteForm(false)}
            >
              ✕
            </button>

            <NoteForm
              clinicianId={clinicianId}
              onSaved={() => setShowNoteForm(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}