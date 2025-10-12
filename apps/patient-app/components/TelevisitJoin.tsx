// apps/patient-app/components/TelevisitJoin.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CountdownBadge from './CountdownBadge';
import Link from 'next/link';

type StatusPayload = {
  now: number;
  visit: { id: string; title: string; startAt: number; endAt: number };
  window: { openAt: number; closeAt: number; isOpen: boolean };
  ticket: null | { token: string; issuedAt: number; expiresAt: number; ttlSec: number };
};

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

export default function TelevisitJoin({ visitId = 'demo-visit' }: { visitId?: string }) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const uidRef = useRef<string>('');

  useEffect(() => {
    uidRef.current = getUid();
    const tick = async () => {
      try {
        const res = await fetch(`/api/televisit/status?visitId=${visitId}`, {
          headers: { 'x-uid': uidRef.current },
          cache: 'no-store',
        });
        const json = (await res.json()) as StatusPayload;
        setStatus(json);
        setError(null);
      } catch (e: any) {
        setError('Unable to fetch status');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visitId]);

  const windowCountdown = useMemo(() => {
    if (!status) return null;
    const { now, window, visit } = status;
    const opensIn = Math.max(0, window.openAt - now);
    const closesIn = Math.max(0, window.closeAt - now);
    const totalBeforeOpen = Math.max(1, visit.startAt - window.openAt);
    const totalDuring = Math.max(1, window.closeAt - window.openAt);
    return {
      showPre: now < window.openAt,
      pre: { total: totalBeforeOpen, remain: opensIn },
      during: { total: totalDuring, remain: closesIn },
    };
  }, [status]);

  async function issueToken() {
    if (!status) return;
    setLoadingToken(true);
    setError(null);
    try {
      const res = await fetch(`/api/televisit/issue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-uid': uidRef.current },
        body: JSON.stringify({ visitId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || 'Join not available yet');
      }
      const j = (await res.json()) as StatusPayload;
      setStatus(j);
    } catch (e: any) {
      setError(e.message || 'Failed to get token');
    } finally {
      setLoadingToken(false);
    }
  }

  const canJoin = !!status?.ticket && status.window.isOpen && status.ticket.expiresAt > (status?.now ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-neutral-200 p-5 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">Tele-visit</div>
            <h1 className="text-xl font-semibold">{status?.visit.title ?? 'Loading…'}</h1>
          </div>
          <div className="text-right text-sm text-neutral-600">
            <div>
              Start:{' '}
              <span className="font-mono">
                {status ? new Date(status.visit.startAt).toLocaleString() : '—'}
              </span>
            </div>
            <div>
              End:{' '}
              <span className="font-mono">
                {status ? new Date(status.visit.endAt).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {status && windowCountdown && (
            <>
              {windowCountdown.showPre ? (
                <CountdownBadge
                  label="Join window opens in"
                  totalMs={windowCountdown.pre.total}
                  untilMs={windowCountdown.pre.remain}
                />
              ) : (
                <CountdownBadge
                  label="Join window closes in"
                  totalMs={windowCountdown.during.total}
                  untilMs={windowCountdown.during.remain}
                  pulseWhenLtSec={20}
                />
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-dashed p-3">
                  <div className="text-sm text-neutral-600">Ticket</div>
                  <div className="font-mono text-xs break-all">
                    {status.ticket ? status.ticket.token : '—'}
                  </div>
                </div>
                {status.ticket ? (
                  <CountdownBadge
                    label="Your token expires in"
                    totalMs={status.ticket.ttlSec * 1000}
                    untilMs={Math.max(0, status.ticket.expiresAt - status.now)}
                    pulseWhenLtSec={15}
                  />
                ) : (
                  <div className="rounded-xl border border-neutral-200 p-3 bg-neutral-50 text-sm text-neutral-600">
                    No token yet
                  </div>
                )}
              </div>
            </>
          )}
          {error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={issueToken}
            disabled={!status?.window.isOpen || loadingToken}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loadingToken ? 'Issuing…' : 'Get Join Token'}
          </button>
          <Link
            href={canJoin ? `/televisit/room?visitId=${encodeURIComponent(status!.visit.id)}` : '#'}
            className={`rounded-lg px-4 py-2 ${
              canJoin ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-600 cursor-not-allowed'
            }`}
            aria-disabled={!canJoin}
          >
            {canJoin ? 'Join Now' : 'Join Disabled'}
          </Link>
        </div>
      </div>
    </div>
  );
}
