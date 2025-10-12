'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Appointment } from '@/lib/types';
import AgendaList from '@/src/components/AgendaList';
import SessionCountdown from '@/src/components/SessionCountdown';
import NoteForm from '@/components/forms/NoteForm';

type PatientAlert = {
  id: string;
  patientName: string;
  type: 'vitals' | 'message' | 'lab';
  message: string;
  timestamp: string;
};

export default function TodayPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const clinicianId = 'clin-demo'; // TODO: get from auth/session

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

  // Mock patient alerts (replace with real API)
  useEffect(() => {
    const mock: PatientAlert[] = [
      { id: 'a1', patientName: 'Nomsa Dlamini', type: 'vitals', message: 'BP elevated: 150/95', timestamp: new Date().toISOString() },
      { id: 'a2', patientName: 'Thabo Mbeki', type: 'message', message: 'Patient sent a follow-up question', timestamp: new Date().toISOString() },
    ];
    setAlerts(mock);
  }, []);

  const nextAppointment = useMemo(() => {
    const upcoming = appointments
      .filter(a => new Date(a.startsAt) > new Date())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return upcoming[0] ?? null;
  }, [appointments]);

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Today's Agenda</h1>
        <div className="text-sm text-gray-600">{appointments.length} appointments scheduled</div>
      </header>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800">Patient Alerts</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {alerts.map(alert => (
              <li key={alert.id} className="p-3 border rounded bg-red-50 text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <span className="font-medium">{alert.patientName}</span>: {alert.message}
                </div>
                <time className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

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
            <SessionCountdown appointment={selected ?? nextAppointment ?? undefined} loading={loading} />
          </div>

          {/* Quick actions */}
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

          {/* AI Insights Placeholder */}
          <div className="p-3 border rounded bg-gray-50">
            <h2 className="font-medium text-slate-800">AI Suggestions</h2>
            <ul className="text-sm list-disc list-inside text-gray-700">
              <li>Review abnormal BP readings for patient XYZ</li>
              <li>Follow-up with patients flagged as high-risk</li>
              <li>Send medication reminders for pending prescriptions</li>
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
