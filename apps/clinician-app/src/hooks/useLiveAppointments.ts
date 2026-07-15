// apps/clinician-app/src/hooks/useLiveAppointments.ts
import { useEffect, useState } from 'react';
import type { Appointment } from '@/lib/types';

type ProgressStatus = 'pre' | 'ongoing' | 'overrun';

type ProgressEntry = {
  pct: number;
  status: ProgressStatus;
};

function stripRefreshKey(clinicianId: string) {
  return String(clinicianId || '').split('::')[0].trim();
}

function asAppointmentList(payload: unknown): Appointment[] {
  const source =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.appointments)
        ? (payload as any).appointments
        : Array.isArray((payload as any)?.items)
          ? (payload as any).items
          : Array.isArray((payload as any)?.data?.appointments)
            ? (payload as any).data.appointments
            : Array.isArray((payload as any)?.data)
              ? (payload as any).data
              : [];

  return source.filter((item: unknown): item is Appointment => {
    return Boolean(item && typeof item === 'object');
  });
}

function appointmentStartIso(appointment: Appointment): string | undefined {
  const item = appointment as Appointment & Record<string, any>;

  return (
    item.start ||
    item.startsAt ||
    item.startTime ||
    item.when ||
    item.whenISO ||
    undefined
  );
}

function appointmentEndIso(appointment: Appointment): string | undefined {
  const item = appointment as Appointment & Record<string, any>;

  if (item.end || item.endsAt || item.endTime) {
    return item.end || item.endsAt || item.endTime;
  }

  const startIso = appointmentStartIso(appointment);
  if (!startIso) return undefined;

  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) return undefined;

  return new Date(startMs + 30 * 60 * 1000).toISOString();
}

function normaliseAppointment(appointment: Appointment): Appointment {
  const item = appointment as Appointment & Record<string, any>;
  const start = appointmentStartIso(appointment);
  const end = appointmentEndIso(appointment);

  return {
    ...item,
    start: start || item.start,
    end: end || item.end,
    roomName: item.roomName || item.roomId || item.meta?.roomId,
  } as Appointment;
}

function getProgressForAppointment(appointment: Appointment, now: number): ProgressEntry {
  const startIso = appointmentStartIso(appointment);
  const endIso = appointmentEndIso(appointment);

  if (!startIso || !endIso) {
    return { pct: 0, status: 'pre' };
  }

  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { pct: 0, status: 'pre' };
  }

  if (now < start) {
    return { pct: 0, status: 'pre' };
  }

  if (now <= end) {
    return {
      pct: Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100))),
      status: 'ongoing',
    };
  }

  return { pct: 100, status: 'overrun' };
}

export function useLiveAppointments(clinicianId: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressEntry>>({});

  useEffect(() => {
    const resolvedClinicianId = stripRefreshKey(clinicianId);

    if (!resolvedClinicianId) {
      setAppointments([]);
      return;
    }

    let cancelled = false;

    const fetchAppointments = async () => {
      try {
        const res = await fetch(
          `/api/_proxy/appointments?clinicianId=${encodeURIComponent(resolvedClinicianId)}`,
          { cache: 'no-store' },
        );

        if (!res.ok) throw new Error('Failed to fetch appointments');

        const payload = await res.json().catch(() => null);
        const next = asAppointmentList(payload).map(normaliseAppointment);

        if (!cancelled) setAppointments(next);
      } catch (error) {
        console.error(error);
        if (!cancelled) setAppointments([]);
      }
    };

    void fetchAppointments();

    const interval = window.setInterval(fetchAppointments, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clinicianId]);

  useEffect(() => {
    const updateProgress = () => {
      const now = Date.now();
      const next: Record<string, ProgressEntry> = {};

      appointments.forEach((appointment) => {
        const id = String((appointment as any).id || '').trim();
        if (!id) return;

        next[id] = getProgressForAppointment(appointment, now);
      });

      setProgressMap(next);
    };

    updateProgress();

    const interval = window.setInterval(updateProgress, 1_000);
    return () => window.clearInterval(interval);
  }, [appointments]);

  return { appointments, progressMap };
}
