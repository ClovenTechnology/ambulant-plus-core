// apps/patient-app/components/RecentActivityStrip.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

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

export default function RecentActivityStrip() {
  const [cases, setCases] = useState<CasePreview[]>([]);
  const [appts, setAppts] = useState<ApptPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [casesRes, apptsRes] = await Promise.allSettled([
          fetch('/api/encounters?mode=cases', { cache: 'no-store' }),
          fetch(`${GATEWAY}/api/appointments?patientId=pt-za-001`, { cache: 'no-store' }),
        ]);

        if (!cancelled && casesRes.status === 'fulfilled' && casesRes.value.ok) {
          const data = await casesRes.value.json().catch(() => ({}));
          const rawCases: any[] = Array.isArray(data.cases)
            ? data.cases
            : Array.isArray(data.encounters)
            ? data.encounters
            : [];
          const mapped = rawCases
            .map((c: any) => ({
              id: String(c.id ?? c.caseId ?? ''),
              title: c.title ?? c.case ?? '',
              updatedAt: c.updatedAt ?? c.start ?? c.startedAt ?? new Date().toISOString(),
            }))
            .filter((c) => c.id)
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
            .slice(0, 2);
          setCases(mapped);
        }

        if (!cancelled && apptsRes.status === 'fulfilled' && apptsRes.value.ok) {
          const data = await apptsRes.value.json().catch(() => ({}));
          const rawAppts: any[] = Array.isArray(data.appointments)
            ? data.appointments
            : [];
          const mapped = rawAppts
            .map((a: any) => ({
              id: String(a.id ?? ''),
              startsAt: a.startsAt ?? a.when ?? '',
              status: a.status ?? 'Scheduled',
            }))
            .filter((a) => a.id && a.startsAt)
            .sort(
              (a, b) =>
                new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            )
            .slice(0, 2);
          setAppts(mapped);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAny = cases.length > 0 || appts.length > 0;

  return (
    <section className="rounded-xl border bg-white px-4 py-3 text-xs text-gray-700 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wide text-[11px] text-gray-500">
          Recent activity
        </span>
        <div className="flex gap-2">
          <Link href="/encounters" className="underline text-[11px] text-blue-700">
            Cases
          </Link>
          <Link href="/appointments" className="underline text-[11px] text-blue-700">
            Appointments
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-3">
          <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
        </div>
      ) : !hasAny ? (
        <p className="text-[11px] text-gray-600">
          After your first booked visit, we&apos;ll show your latest case updates and upcoming
          appointments here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {cases.map((c) => (
            <Link
              key={c.id}
              href="/encounters"
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 bg-gray-50 hover:bg-gray-100"
            >
              <span className="text-[10px] uppercase text-gray-500">Case</span>
              <span className="font-medium truncate max-w-[140px]">
                {c.title || `Case ${c.id}`}
              </span>
              <span className="text-[10px] text-gray-500">
                • {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}

          {appts.map((a) => (
            <Link
              key={a.id}
              href="/appointments"
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 bg-gray-50 hover:bg-gray-100"
            >
              <span className="text-[10px] uppercase text-gray-500">Appt</span>
              <span className="font-medium truncate max-w-[140px]">
                {new Date(a.startsAt).toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500">• {a.status}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
