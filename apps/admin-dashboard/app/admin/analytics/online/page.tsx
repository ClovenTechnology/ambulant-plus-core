//apps/admin-dashboard/app/admin/analytics/online/page.tsx
import React from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ActorNow = { actorType: string; count: number };

type NowSummary = {
  totalOnline: number;
  byActorType: ActorNow[];
};

type DurationSummary = {
  actorType: string;
  users: number;
  totalSeconds: number;
  avgSeconds: number;
  minSeconds: number;
  maxSeconds: number;
};

type SessionNow = {
  id: string;
  userId: string;
  actorType: string;
  actorRefId?: string | null;
  app: string;
  startedAt: string;
  lastSeenAt: string;
  ipCountry?: string | null;
  ipCity?: string | null;
};

type OnlineAnalyticsResponse = {
  ok: boolean;
  now: NowSummary;
  today: DurationSummary[];
  thisMonth: DurationSummary[];
  byGeoToday: { country: string; actorType: string; totalUsers: number }[];
  sessionsNow: SessionNow[];
};

function fmtSeconds(secs: number) {
  if (!secs || secs <= 0) return '0m';
  const minutes = Math.round(secs / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `${hours}h ${remMins}m`;
}

function labelActorType(t: string) {
  switch (t) {
    case 'PATIENT':
      return 'Patients';
    case 'CLINICIAN':
      return 'Clinicians';
    case 'PHLEB':
      return 'Phlebs';
    case 'RIDER':
      return 'Riders';
    case 'SHOPPER':
      return 'Shoppers';
    case 'ADMIN':
      return 'Admins';
    case 'CLINICIAN_STAFF_MEDICAL':
      return 'Clinician staff (medical)';
    case 'CLINICIAN_STAFF_NON_MEDICAL':
      return 'Clinician staff (non-medical)';
    default:
      return t;
  }
}

export default async function AdminOnlineAnalyticsPage() {
  const gateway =
    process.env.NEXT_PUBLIC_APIGW_BASE?.trim() ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() ||
    'http://127.0.0.1:3010';

  const adminKey = process.env.ADMIN_API_KEY || '';

  let data: OnlineAnalyticsResponse | null = null;
  let error: string | null = null;

  try {
    const url = `${gateway}/api/admin/analytics/online`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-admin-key': adminKey,
      },
      cache: 'no-store',
    });
    const js = (await res.json().catch(() => ({}))) as OnlineAnalyticsResponse;
    if (!res.ok || !js.ok) {
      throw new Error((js as any)?.error || `HTTP ${res.status}`);
    }
    data = js;
  } catch (e: any) {
    console.error('[admin/analytics/online] fetch error', e);
    error = e?.message || 'Failed to load online analytics';
  }

  if (!data) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Online presence analytics</h1>
        {error ? (
          <div className="mt-4 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        )}
      </main>
    );
  }

  const now = data.now;
  const today = data.today;
  const month = data.thisMonth;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Online presence analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Live presence across all Ambulant+ apps: patients, clinicians, phlebs, riders,
            shoppers, admin and clinician staff.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Gateway:{' '}
          <span className="font-mono">
            {gateway}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      {/* Top summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg bg-white p-4">
          <div className="text-xs text-gray-500">Online now (all roles)</div>
          <div className="mt-1 text-2xl font-semibold">{now.totalOnline}</div>
          <div className="mt-1 text-[11px] text-gray-500">
            Active sessions in the last 2 minutes.
          </div>
        </div>

        {['CLINICIAN', 'PATIENT', 'RIDER', 'PHLEB'].map((t) => {
          const entry = now.byActorType.find((x) => x.actorType === t);
          return (
            <div key={t} className="border rounded-lg bg-white p-4">
              <div className="text-xs text-gray-500">
                {labelActorType(t)} online
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {entry?.count ?? 0}
              </div>
            </div>
          );
        })}
      </section>

      {/* Today & Month overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg bg-white p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Today</h2>
            <span className="text-[11px] text-gray-500">
              Total & average time online per role
            </span>
          </div>
          {today.length === 0 ? (
            <div className="text-gray-500">No presence data for today.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-2 py-1 border-b">Role</th>
                    <th className="px-2 py-1 border-b">Users</th>
                    <th className="px-2 py-1 border-b">Avg time</th>
                    <th className="px-2 py-1 border-b">Min</th>
                    <th className="px-2 py-1 border-b">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {today.map((row) => (
                    <tr key={row.actorType} className="border-t">
                      <td className="px-2 py-1 align-top">
                        {labelActorType(row.actorType)}
                      </td>
                      <td className="px-2 py-1 align-top">{row.users}</td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.avgSeconds)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.minSeconds)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.maxSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border rounded-lg bg-white p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">
              This month to date
            </h2>
            <span className="text-[11px] text-gray-500">
              Cumulative time online per role
            </span>
          </div>
          {month.length === 0 ? (
            <div className="text-gray-500">
              No presence data for this month yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-2 py-1 border-b">Role</th>
                    <th className="px-2 py-1 border-b">Users</th>
                    <th className="px-2 py-1 border-b">Avg time</th>
                    <th className="px-2 py-1 border-b">Min</th>
                    <th className="px-2 py-1 border-b">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {month.map((row) => (
                    <tr key={row.actorType} className="border-t">
                      <td className="px-2 py-1 align-top">
                        {labelActorType(row.actorType)}
                      </td>
                      <td className="px-2 py-1 align-top">{row.users}</td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.avgSeconds)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.minSeconds)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {fmtSeconds(row.maxSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Geo breakdown */}
      <section className="border rounded-lg bg-white p-4 text-xs">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Geo breakdown (today)
          </h2>
          <span className="text-[11px] text-gray-500">
            Unique users by country & role
          </span>
        </div>
        {data.byGeoToday.length === 0 ? (
          <div className="text-gray-500">No geo data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-2 py-1 border-b">Country</th>
                  <th className="px-2 py-1 border-b">Role</th>
                  <th className="px-2 py-1 border-b">Users</th>
                </tr>
              </thead>
              <tbody>
                {data.byGeoToday.map((row, idx) => (
                  <tr key={`${row.country}-${row.actorType}-${idx}`} className="border-t">
                    <td className="px-2 py-1 align-top">{row.country}</td>
                    <td className="px-2 py-1 align-top">
                      {labelActorType(row.actorType)}
                    </td>
                    <td className="px-2 py-1 align-top">{row.totalUsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Live sessions table */}
      <section className="border rounded-lg bg-white p-4 text-xs">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Live sessions (last 2 minutes)
          </h2>
          <span className="text-[11px] text-gray-500">
            Up to 500 most recent sessions
          </span>
        </div>
        {data.sessionsNow.length === 0 ? (
          <div className="text-gray-500">No one is online right now.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-2 py-1 border-b">Role</th>
                  <th className="px-2 py-1 border-b">User ID</th>
                  <th className="px-2 py-1 border-b">App</th>
                  <th className="px-2 py-1 border-b">Actor ref</th>
                  <th className="px-2 py-1 border-b">Location</th>
                  <th className="px-2 py-1 border-b">Online since</th>
                  <th className="px-2 py-1 border-b">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.sessionsNow.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1 align-top">
                      {labelActorType(s.actorType)}
                    </td>
                    <td className="px-2 py-1 align-top font-mono text-[11px]">
                      {s.userId}
                    </td>
                    <td className="px-2 py-1 align-top">{s.app}</td>
                    <td className="px-2 py-1 align-top font-mono text-[11px]">
                      {s.actorRefId || '—'}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {s.ipCity || s.ipCountry
                        ? `${s.ipCity ? s.ipCity + ', ' : ''}${s.ipCountry || ''}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {new Date(s.lastSeenAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
