// apps/patient-app/components/RecentActivityStrip.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type CasePreview = {
  id: string;
  title?: string;
  updatedAt: string;
};

type ApptPreview = {
  id: string;
  startsAt: string;
  status: string;
};

type RecentActivityStripProps = {
  patientId?: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Scheduled';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function normaliseCases(payload: unknown): CasePreview[] {
  const root = isRecord(payload) ? payload : {};

  const rawCases = Array.isArray(root.cases)
    ? root.cases
    : Array.isArray(root.encounters)
      ? root.encounters
      : [];

  return rawCases
    .map((item): CasePreview | null => {
      if (!isRecord(item)) return null;

      const id = toStringValue(item.id ?? item.caseId).trim();
      if (!id) return null;

      return {
        id,
        title: toStringValue(item.title ?? item.caseTitle ?? item.case).trim(),
        updatedAt:
          toStringValue(item.updatedAt ?? item.stop ?? item.start ?? item.startedAt).trim() ||
          new Date().toISOString(),
      };
    })
    .filter((item): item is CasePreview => Boolean(item))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 2);
}

function normaliseAppointments(payload: unknown): ApptPreview[] {
  const root = isRecord(payload) ? payload : {};
  const rawAppts = Array.isArray(root.appointments)
    ? root.appointments
    : Array.isArray(root.items)
      ? root.items
      : [];

  return rawAppts
    .map((item): ApptPreview | null => {
      if (!isRecord(item)) return null;

      const id = toStringValue(item.id).trim();
      const startsAt = toStringValue(item.startsAt ?? item.startTime ?? item.when).trim();

      if (!id || !startsAt) return null;

      return {
        id,
        startsAt,
        status: toStringValue(item.status, 'Scheduled'),
      };
    })
    .filter((item): item is ApptPreview => Boolean(item))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 2);
}

export default function RecentActivityStrip({ patientId = null }: RecentActivityStripProps) {
  const [cases, setCases] = useState<CasePreview[]>([]);
  const [appts, setAppts] = useState<ApptPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const encodedPatientId = useMemo(
    () =>
      typeof patientId === 'string' && patientId.trim()
        ? encodeURIComponent(patientId.trim())
        : '',
    [patientId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!encodedPatientId) {
        setCases([]);
        setAppts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const casesUrl = `/api/encounters?mode=cases&patientId=${encodedPatientId}&limit=2`;
        const appointmentsUrl = `/api/appointments?patientId=${encodedPatientId}&limit=2`;

        const [casesRes, apptsRes] = await Promise.allSettled([
          fetch(casesUrl, { cache: 'no-store' }),
          fetch(appointmentsUrl, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (casesRes.status === 'fulfilled' && casesRes.value.ok) {
          const data = await casesRes.value.json().catch(() => ({}));
          if (!cancelled) setCases(normaliseCases(data));
        } else {
          setCases([]);
        }

        if (apptsRes.status === 'fulfilled' && apptsRes.value.ok) {
          const data = await apptsRes.value.json().catch(() => ({}));
          if (!cancelled) setAppts(normaliseAppointments(data));
        } else {
          setAppts([]);
        }
      } catch {
        if (!cancelled) {
          setCases([]);
          setAppts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [encodedPatientId]);

  const hasAny = cases.length > 0 || appts.length > 0;

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/70 bg-white/82 px-4 py-3 text-xs text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-50/50 via-white/40 to-indigo-50/45" />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Recent activity
            </span>
            <p className="mt-1 text-[12px] text-slate-500">
              Your latest care movement across cases and appointments.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/encounters"
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cases
            </Link>
            <Link
              href="/appointments"
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Appointments
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-wrap gap-3">
            <div className="h-8 w-44 animate-pulse rounded-full bg-slate-100" />
            <div className="h-8 w-52 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : !hasAny ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3">
            <p className="text-[12px] leading-5 text-slate-600">
              Your activity timeline is ready. New case updates and scheduled appointments
              will appear here as soon as they are available.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {cases.map((item) => (
              <Link
                key={item.id}
                href={`/encounters`}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/86 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                  Case
                </span>
                <span className="max-w-[150px] truncate font-medium text-slate-800">
                  {item.title || 'Clinical case'}
                </span>
                <span className="text-[10px] text-slate-400">• {formatDate(item.updatedAt)}</span>
              </Link>
            ))}

            {appts.map((item) => (
              <Link
                key={item.id}
                href="/appointments"
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/86 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
                  Appt
                </span>
                <span className="max-w-[170px] truncate font-medium text-slate-800">
                  {formatDateTime(item.startsAt)}
                </span>
                <span className="text-[10px] text-slate-400">• {item.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
