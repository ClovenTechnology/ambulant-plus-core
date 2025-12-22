// apps/patient-app/components/TelevisitJoin.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CountdownBadge from './CountdownBadge';
import Link from 'next/link';

type TelevisitRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

type StatusPayload = {
  ok: boolean;
  now?: string; // ISO
  visitId?: string;
  roomId?: string;
  window?: {
    joinOpensAt?: string; // ISO
    joinClosesAt?: string; // ISO
    isOpen?: boolean;
  };
  consent?: { ok?: boolean };
  ticket?: {
    provided?: boolean;
    valid?: boolean;
    expiresAt?: string | null; // ISO
  };
  needsConsent?: boolean;
  needsTicket?: boolean;
  error?: string;
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

function toMs(iso?: string | null) {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function ssKey(visitId: string) {
  return `televisit_join_jwt:${visitId}`;
}
function ssKeyExp(visitId: string) {
  return `televisit_join_jwt_exp:${visitId}`;
}

export default function TelevisitJoin({
  visitId = 'demo-visit',
  role = 'patient',
}: {
  visitId?: string;
  role?: TelevisitRole;
}) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);

  const [joinJwt, setJoinJwt] = useState<string>('');
  const [joinJwtExpMs, setJoinJwtExpMs] = useState<number>(0);

  const uidRef = useRef<string>('');

  const searchParams = useSearchParams();
  const personId = searchParams?.get('personId') || null;

  // Load any saved token (session only)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ssKey(visitId)) || '';
      const savedExp = Number(sessionStorage.getItem(ssKeyExp(visitId)) || '0') || 0;
      if (saved && savedExp && Date.now() < savedExp) {
        setJoinJwt(saved);
        setJoinJwtExpMs(savedExp);
      } else {
        sessionStorage.removeItem(ssKey(visitId));
        sessionStorage.removeItem(ssKeyExp(visitId));
      }
    } catch {
      // ignore
    }
  }, [visitId]);

  // Poll status (and validate token if we have one by sending x-join-token)
  useEffect(() => {
    uidRef.current = getUid();

    const tick = async () => {
      try {
        const qs = new URLSearchParams({ visitId });
        if (personId) qs.set('personId', personId);

        const headers: Record<string, string> = {
          'x-uid': uidRef.current,
          'x-role': role,
        };
        if (joinJwt) headers['x-join-token'] = joinJwt;

        const res = await fetch(`/api/televisit/status?${qs.toString()}`, {
          headers,
          cache: 'no-store',
        });

        const json = (await res.json().catch(() => null)) as StatusPayload | null;

        if (!res.ok || !json) {
          setError('Unable to fetch status');
          return;
        }

        setStatus(json);
        setError(null);

        // If token expired locally, wipe it (even if server didn’t check it)
        if (joinJwt && joinJwtExpMs && Date.now() >= joinJwtExpMs) {
          setJoinJwt('');
          setJoinJwtExpMs(0);
          try {
            sessionStorage.removeItem(ssKey(visitId));
            sessionStorage.removeItem(ssKeyExp(visitId));
          } catch {
            // ignore
          }
        }
      } catch {
        setError('Unable to fetch status');
      }
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [visitId, personId, role, joinJwt, joinJwtExpMs]);

  const nowMs = useMemo(() => toMs(status?.now), [status?.now]);
  const openAtMs = useMemo(() => toMs(status?.window?.joinOpensAt), [status?.window?.joinOpensAt]);
  const closeAtMs = useMemo(() => toMs(status?.window?.joinClosesAt), [status?.window?.joinClosesAt]);

  const windowCountdown = useMemo(() => {
    if (!status?.ok) return null;

    const now = nowMs || Date.now();
    const openAt = openAtMs;
    const closeAt = closeAtMs;

    if (!openAt || !closeAt) return null;

    const opensIn = Math.max(0, openAt - now);
    const closesIn = Math.max(0, closeAt - now);

    const totalBeforeOpen = Math.max(1, openAt - Math.max(1, now - 1)); // keeps bar non-zero
    const totalDuring = Math.max(1, closeAt - openAt);

    return {
      showPre: now < openAt,
      pre: { total: totalBeforeOpen, remain: opensIn },
      during: { total: totalDuring, remain: closesIn },
    };
  }, [status?.ok, nowMs, openAtMs, closeAtMs]);

  async function issueToken(force = false) {
    setLoadingToken(true);
    setError(null);
    try {
      const body: any = { visitId };
      if (personId) body.personId = personId;
      if (force) body.force = true;

      const res = await fetch(`/api/televisit/issue`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': uidRef.current,
          'x-role': role,
        },
        body: JSON.stringify(body),
      });

      const j = (await res.json().catch(() => ({}))) as any;

      if (!res.ok || !j?.ok) {
        const msg =
          j?.error ||
          j?.message ||
          (res.status === 409
            ? 'Active ticket exists already. Use Rotate Token.'
            : 'Unable to issue join token');
        throw new Error(String(msg));
      }

      const token = String(j?.joinToken || '').trim();
      const expiresAtMs = toMs(j?.expiresAt);

      if (!token || !expiresAtMs) {
        throw new Error('Server returned an invalid join token payload');
      }

      // Store securely: memory + sessionStorage (no URL, no UI rendering)
      setJoinJwt(token);
      setJoinJwtExpMs(expiresAtMs);

      try {
        sessionStorage.setItem(ssKey(visitId), token);
        sessionStorage.setItem(ssKeyExp(visitId), String(expiresAtMs));
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to get token');
    } finally {
      setLoadingToken(false);
    }
  }

  const consentOk = !!status?.consent?.ok;
  const windowOpen = !!status?.window?.isOpen;

  // If status validated the token, trust it. Else fall back to local expiry check.
  const ticketValid =
    !!status?.ticket?.valid ||
    (!!joinJwt && !!joinJwtExpMs && Date.now() < joinJwtExpMs && windowOpen);

  const canGetToken = windowOpen && consentOk;
  const canJoin = windowOpen && consentOk && !!joinJwt && ticketValid;

  const joinTarget = (status?.roomId || status?.visitId || visitId).trim();
  const joinHref = joinTarget ? `/televisit/${encodeURIComponent(joinTarget)}` : '#';

  const ticketExpiresMs = status?.ticket?.expiresAt ? toMs(status.ticket.expiresAt) : joinJwtExpMs;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-neutral-200 p-5 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">Tele-visit</div>
            <h1 className="text-xl font-semibold">
              {status?.ok ? `Room: ${status?.roomId || '—'}` : 'Loading…'}
            </h1>
            <div className="mt-1 text-xs text-neutral-500">
              Visit ID: <span className="font-mono">{status?.visitId || visitId}</span>
            </div>
          </div>

          <div className="text-right text-sm text-neutral-600">
            <div>
              Opens:{' '}
              <span className="font-mono">
                {openAtMs ? new Date(openAtMs).toLocaleString() : '—'}
              </span>
            </div>
            <div>
              Closes:{' '}
              <span className="font-mono">
                {closeAtMs ? new Date(closeAtMs).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {windowCountdown && (
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
            </>
          )}

          {!consentOk && windowOpen && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Consent is required before a join token can be issued.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed p-3">
              <div className="text-sm text-neutral-600">Join Ticket</div>
              <div className="mt-1 text-sm">
                {joinJwt ? (
                  <span className="text-emerald-700 font-medium">Issued (stored securely for this session)</span>
                ) : (
                  <span className="text-neutral-500">Not issued yet</span>
                )}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                (Token is never displayed.)
              </div>
            </div>

            {ticketExpiresMs ? (
              <CountdownBadge
                label="Ticket expires in"
                totalMs={Math.max(1, ticketExpiresMs - (nowMs || Date.now()) + 1)}
                untilMs={Math.max(0, ticketExpiresMs - (nowMs || Date.now()))}
                pulseWhenLtSec={15}
              />
            ) : (
              <div className="rounded-xl border border-neutral-200 p-3 bg-neutral-50 text-sm text-neutral-600">
                No active ticket
              </div>
            )}
          </div>

          {error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => issueToken(false)}
            disabled={!canGetToken || loadingToken}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loadingToken ? 'Issuing…' : 'Get Join Token'}
          </button>

          <button
            onClick={() => issueToken(true)}
            disabled={!canGetToken || loadingToken}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 disabled:opacity-50"
            title="Force-rotate the join ticket"
          >
            Rotate Token
          </button>

          <Link
            href={canJoin ? joinHref : '#'}
            className={`rounded-lg px-4 py-2 ${
              canJoin
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-200 text-neutral-600 cursor-not-allowed pointer-events-none'
            }`}
            aria-disabled={!canJoin}
            tabIndex={canJoin ? 0 : -1}
          >
            {canJoin ? 'Join Now' : 'Join Disabled'}
          </Link>
        </div>
      </div>
    </div>
  );
}
