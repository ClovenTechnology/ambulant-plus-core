// apps/clinician-app/app/hooks/useAppointmentsRealtime.ts
'use client';

import { useEffect } from 'react';

type OnEvent = (ev: { kind: string; payload?: any }) => void;

export default function useAppointmentsRealtime(clinicianId: string, onEvent: OnEvent) {
  useEffect(() => {
    if (!clinicianId) return;
    const base =
      process.env.GATEWAY_URL ||
      process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      '';
    if (!base) return;

    const url = new URL(`${base}/api/events/stream`);
    url.searchParams.set('clinicianId', clinicianId);
    url.searchParams.set('kinds', 'appointment.created,appointment.confirmed,appointment.updated');

    const es = new EventSource(url.toString(), { withCredentials: false });

    const handler = (kind: string) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data || '{}');
        onEvent({ kind, payload: data });
      } catch {
        onEvent({ kind, payload: e.data });
      }
    };

    es.addEventListener('appointment.created', handler('appointment.created'));
    es.addEventListener('appointment.confirmed', handler('appointment.confirmed'));
    es.addEventListener('appointment.updated', handler('appointment.updated'));

    es.onerror = () => {
      // let browser auto-reconnect; no-op
    };

    return () => es.close();
  }, [clinicianId, onEvent]);
}
