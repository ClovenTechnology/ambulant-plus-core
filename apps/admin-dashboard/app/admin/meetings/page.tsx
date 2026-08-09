'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarPlus, RefreshCw, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

type MeetingRow = {
  id: string;
  kind: string;
  state: string;
  title: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  locked?: boolean;
  participants?: Array<{
    id: string;
    displayName: string;
    role: string;
    state: string;
  }>;
};

export default function AdminMeetingsPage() {
  const [items, setItems] = useState<MeetingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/admin/meetings?pageSize=50', {
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to load meetings');
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load meetings');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Ambulant+ collaboration
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Meetings
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Shared meeting authority for staff collaboration, direct calls,
            interviews and verified external guests.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <Link
            href="/admin/meetings/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            <CalendarPlus className="h-4 w-4" />
            New meeting
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_0.7fr_1fr_0.7fr_auto] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Meeting</div>
          <div>State</div>
          <div>Schedule</div>
          <div>Participants</div>
          <div />
        </div>

        {items.length === 0 && !busy ? (
          <div className="p-8 text-sm text-slate-500">
            No meetings found.
          </div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1.5fr_0.7fr_1fr_0.7fr_auto] gap-3 border-b px-5 py-4 text-sm last:border-b-0"
          >
            <div>
              <div className="font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs text-slate-500">{item.kind}</div>
            </div>

            <div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                {item.state}
              </span>
              {item.locked ? (
                <div className="mt-2 text-xs text-amber-700">Locked</div>
              ) : null}
            </div>

            <div>
              <div>{new Date(item.startsAt).toLocaleString()}</div>
              <div className="mt-1 text-xs text-slate-500">
                {item.durationMinutes} min · {item.timezone}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-slate-600">
              <Users className="h-4 w-4" />
              {item.participants?.length || 0}
            </div>

            <Link
              href={`/admin/meetings/${encodeURIComponent(item.id)}`}
              className="self-start rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              Open
            </Link>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900">
        This batch establishes scheduling, external invitation, lobby and RTC credential
        authority. Enterprise LiveKit room rendering, persistent internal room chat and direct-call controls now use these canonical records.
      </div>
    </main>
  );
}
