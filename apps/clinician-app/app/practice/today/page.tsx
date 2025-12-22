// apps/clinician-app/app/practice/today/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type SessionRow = {
  id: string;
  caseId: string;
  patientDisplayName: string;
  startTime: string;
  mode: 'virtual' | 'in_person';
  departmentName?: string | null;
  mainClinician: {
    id: string;
    name: string;
  };
  observers: { id: string; name: string }[];
  roomId?: string | null;
};

type ByClinicianRow = {
  clinicianId: string;
  clinicianName: string;
  totalToday: number;
  virtual: number;
  inPerson: number;
};

type ByDepartmentRow = {
  departmentId: string;
  name: string;
  totalToday: number;
};

type PracticeTodayResponse = {
  practiceName: string;
  date: string;
  totalSessions: number;
  totalVirtual: number;
  totalInPerson: number;
  sessions: SessionRow[];
  byClinician: ByClinicianRow[];
  byDepartment: ByDepartmentRow[];
};

function fallbackToday(): PracticeTodayResponse {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  return {
    practiceName: 'Demo Multi-Clinic Practice',
    date: isoDate,
    totalSessions: 4,
    totalVirtual: 3,
    totalInPerson: 1,
    sessions: [
      {
        id: 'sess-101',
        caseId: 'case-9001',
        patientDisplayName: 'Demo Patient A',
        startTime: new Date().toISOString(),
        mode: 'virtual',
        departmentName: 'General Practice',
        mainClinician: { id: 'clin-1', name: 'Dr A. Demo' },
        observers: [],
        roomId: 'room-101',
      },
      {
        id: 'sess-102',
        caseId: 'case-9002',
        patientDisplayName: 'Demo Patient B',
        startTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        mode: 'virtual',
        departmentName: 'Cardiology',
        mainClinician: { id: 'clin-2', name: 'Dr B. Demo' },
        observers: [{ id: 'clin-3', name: 'Dr C. Observer' }],
        roomId: 'room-102',
      },
      {
        id: 'sess-103',
        caseId: 'case-9003',
        patientDisplayName: 'Demo Patient C',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        mode: 'in_person',
        departmentName: 'Orthopaedics',
        mainClinician: { id: 'clin-1', name: 'Dr A. Demo' },
        observers: [],
        roomId: 'room-103',
      },
      {
        id: 'sess-104',
        caseId: 'case-9004',
        patientDisplayName: 'Demo Patient D',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        mode: 'virtual',
        departmentName: 'Psychology',
        mainClinician: { id: 'clin-4', name: 'Dr D. Demo' },
        observers: [],
        roomId: 'room-104',
      },
    ],
    byClinician: [
      { clinicianId: 'clin-1', clinicianName: 'Dr A. Demo', totalToday: 2, virtual: 1, inPerson: 1 },
      { clinicianId: 'clin-2', clinicianName: 'Dr B. Demo', totalToday: 1, virtual: 1, inPerson: 0 },
      { clinicianId: 'clin-4', clinicianName: 'Dr D. Demo', totalToday: 1, virtual: 1, inPerson: 0 },
    ],
    byDepartment: [
      { departmentId: 'dep-gp', name: 'General Practice', totalToday: 1 },
      { departmentId: 'dep-card', name: 'Cardiology', totalToday: 1 },
      { departmentId: 'dep-ortho', name: 'Orthopaedics', totalToday: 1 },
      { departmentId: 'dep-psych', name: 'Psychology', totalToday: 1 },
    ],
  };
}

export default function PracticeTodayPage() {
  const [data, setData] = useState<PracticeTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/practice/today`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
            'x-scope': 'practice',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as PracticeTodayResponse | null;
        if (cancelled) return;
        setData(
          js && js.sessions
            ? js
            : fallbackToday(),
        );
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[practice/today] falling back to demo:', e?.message);
        setErr('Using demo data (practice/today API not wired yet).');
        setData(fallbackToday());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const upcoming = useMemo(
    () =>
      (data?.sessions || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
    [data],
  );

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Practice — Today
          </h1>
          <p className="text-sm text-gray-500">
            Practice-wide agenda, grouped by clinician & department.
          </p>
          {data && (
            <p className="mt-1 text-xs text-gray-500">
              {data.practiceName} · {data.date}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-xs text-gray-500">
          {loading && <span>Refreshing…</span>}
          {err && <span className="max-w-xs text-right text-amber-700">{err}</span>}
        </div>
      </header>

      {data && (
        <section className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total sessions today"
            value={data.totalSessions}
            hint={`${data.totalVirtual} virtual · ${data.totalInPerson} in-person`}
          />
          <KpiCard
            label="Virtual sessions"
            value={data.totalVirtual}
            hint="Televisits via Ambulant+ SFU"
          />
          <KpiCard
            label="In-person sessions"
            value={data.totalInPerson}
            hint="Practice rooms & ward rounds"
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Left: sessions list */}
        <section className="rounded-lg border bg-white p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming sessions
            </h2>
            <span className="text-xs text-gray-500">
              {upcoming.length} today
            </span>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-xs text-gray-500">
              No sessions scheduled for today.
            </div>
          ) : (
            <div className="divide-y">
              {upcoming.map((s) => (
                <article key={s.id} className="flex gap-3 py-2">
                  <div className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-sm font-medium text-slate-900">
                        {s.patientDisplayName}
                      </span>
                      <span className="text-xs text-gray-500">
                        • {s.mainClinician.name}
                      </span>
                      {s.departmentName && (
                        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {s.departmentName}
                        </span>
                      )}
                      <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                        {s.mode === 'virtual' ? 'Virtual' : 'In-person'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(s.startTime).toLocaleString()} · Case{' '}
                      <span className="font-mono">{s.caseId}</span>
                    </div>
                    {s.observers?.length > 0 && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        Observers:{' '}
                        {s.observers.map((o) => o.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-center gap-1">
                    {s.roomId && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`/sfu/${encodeURIComponent(s.roomId!)}`, '_blank')
                        }
                        className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
                      >
                        Join room
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
                      onClick={() =>
                        window.open(
                          `/encounters/${encodeURIComponent(s.caseId)}`,
                          '_blank',
                        )
                      }
                    >
                      Open encounter
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Right: by clinician & department */}
        <aside className="space-y-4 text-xs">
          <div className="rounded-lg border bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-800">
              Sessions by clinician
            </h3>
            {data?.byClinician?.length ? (
              <ul className="space-y-1">
                {data.byClinician.map((c) => (
                  <li
                    key={c.clinicianId}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate text-gray-700">
                      {c.clinicianName}
                    </span>
                    <span className="flex items-center gap-2 text-gray-800">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                        {c.totalToday} total
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {c.virtual} V · {c.inPerson} IP
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500">No clinicians scheduled.</div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-800">
              Sessions by department
            </h3>
            {data?.byDepartment?.length ? (
              <ul className="space-y-1">
                {data.byDepartment.map((d) => (
                  <li
                    key={d.departmentId}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate text-gray-700">
                      {d.name}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-gray-800">
                      {d.totalToday}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500">No departments with sessions.</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-3 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>
      )}
    </div>
  );
}
