'use client';

import { useEffect, useRef, useState } from 'react';
export type Vital = { t: string; type: string; value: number; unit?: string };

function useVitalsSSEImpl(roomId?: string | null, url?: string) {
  const [data, setData] = useState<Vital[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    try { esRef.current?.close(); } catch {}
    esRef.current = null;

    if (!roomId) { setData([]); return; }

    const base = url || (process?.env?.NEXT_PUBLIC_BASE_URL ?? '');
    const endpoint = `${base}/api/iomt/sse?roomId=${encodeURIComponent(roomId)}`;

    const es = new EventSource(endpoint);
    esRef.current = es;

    es.addEventListener('message', (e) => {
      try {
        const v = JSON.parse(e.data) as Vital;
        if (v?.type && typeof v.value === 'number') {
          setData((arr) => [...arr, v].slice(-60));
        }
      } catch {}
    });
    es.addEventListener('error', () => { try { es.close(); } catch {} });

    return () => { try { es.close(); } catch {} };
  }, [roomId, url]);

  return data;
}

export default function useVitalsSSE(roomId?: string | null, url?: string) {
  return useVitalsSSEImpl(roomId, url);
}
export { useVitalsSSEImpl as useVitalsSSE };
