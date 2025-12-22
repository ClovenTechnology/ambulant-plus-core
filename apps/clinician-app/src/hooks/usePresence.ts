'use client';

import { useEffect, useRef } from 'react';

const GATEWAY =
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  '';

type PresenceActorType =
  | 'PATIENT'
  | 'CLINICIAN'
  | 'PHLEB'
  | 'RIDER'
  | 'SHOPPER'
  | 'ADMIN'
  | 'CLINICIAN_STAFF_MEDICAL'
  | 'CLINICIAN_STAFF_NON_MEDICAL';

type PresenceOptions = {
  actorType: PresenceActorType;
  actorRefId?: string;
  app: string; // e.g. 'clinician-app'
};

export function usePresence(options: PresenceOptions | null) {
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!options || !GATEWAY) return;

    let cancelled = false;

    async function start() {
      try {
        const res = await fetch(`${GATEWAY}/api/presence/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(options),
        });

        const js = await res.json().catch(() => ({}));
        if (res.ok && js.ok && js.sessionId && !cancelled) {
          sessionIdRef.current = js.sessionId;

          intervalRef.current = setInterval(async () => {
            const sessionId = sessionIdRef.current;
            if (!sessionId) return;
            try {
              await fetch(`${GATEWAY}/api/presence/heartbeat`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
            } catch {
              // ignore
            }
          }, 45_000); // 45s heartbeat
        }
      } catch {
        // ignore
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const sessionId = sessionIdRef.current;
      if (sessionId && GATEWAY) {
        fetch(`${GATEWAY}/api/presence/end`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      }
    };
  }, [options]);
}
