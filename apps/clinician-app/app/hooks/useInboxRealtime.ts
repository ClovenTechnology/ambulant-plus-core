// apps/clinician-app/app/hooks/useInboxRealtime.ts
'use client';

import { useEffect, useRef } from 'react';

type InboxEvent = {
  id?: string;
  kind: string;
  payload?: any;
  ts?: string | number;
};

type Opts = {
  clinicianId: string;         // required to scope the inbox
  orgId?: string;              // optional per-tenant scoping
  onEvent: (ev: InboxEvent) => void;
  intervalMs?: number;         // default 2000ms
};

export default function useInboxRealtime(opts: Opts) {
  const { clinicianId, orgId, onEvent, intervalMs = 2000 } = opts;
  const afterIdRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!clinicianId) return;

    let cancelled = false;

    async function tick() {
      try {
        const base =
          process.env.GATEWAY_URL ||
          process.env.APIGW_BASE ||
          process.env.NEXT_PUBLIC_APIGW_BASE ||
          '';

        if (!base) return;

        const url = new URL(`${base}/api/events/inbox`);
        url.searchParams.set('clinicianId', clinicianId);
        if (afterIdRef.current) url.searchParams.set('afterId', afterIdRef.current);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            // identity & tenancy (adjust if your auth layer injects these automatically)
            'x-uid': clinicianId,
            'x-role': 'clinician',
            ...(orgId ? { 'x-org': orgId } : {}),
          },
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({ events: [] as any[] }));
        const events: any[] = Array.isArray(data?.events) ? data.events : [];

        for (const ev of events) {
          if (cancelled) return;
          afterIdRef.current = ev.id || afterIdRef.current;
          try {
            const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
            onEvent({ id: ev.id, kind: ev.kind, ts: ev.ts, payload });
          } catch {
            onEvent({ id: ev.id, kind: ev.kind, ts: ev.ts, payload: ev.payload });
          }
        }
      } catch {
        // swallow errors; we'll try again on next tick
      } finally {
        if (!cancelled) {
          // @ts-ignore - setTimeout types in Next.js
          timerRef.current = window.setTimeout(tick, intervalMs);
        }
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    };
  }, [clinicianId, orgId, intervalMs, onEvent]);
}
