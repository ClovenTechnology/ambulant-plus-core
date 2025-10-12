// apps/patient-app/components/useVitalsSSE.ts
'use client';

import { useEffect, useRef, useState } from 'react';

export type GroupedVitals = {
  ts: number;
  hr?: number;
  spo2?: number;
  temp?: number;
  tempC?: number;
  rr?: number;
  bp?: { sys?: number; dia?: number };
  glucose?: number;
};

export type VitalSample = { t: number; type: string; value: number; unit?: string };

type ReturnShape = {
  latest: GroupedVitals | null;
  buffer: GroupedVitals[];
  samples: VitalSample[];
};

function _use(roomId: string, maxPoints: number = 240): ReturnShape {
  const [latest, setLatest] = useState<GroupedVitals | null>(null);
  const [buffer, setBuffer] = useState<GroupedVitals[]>([]);
  const [samples, setSamples] = useState<VitalSample[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!roomId) return;
    try { esRef.current?.close(); } catch {}
    const es = new EventSource(`/api/iomt/sse?roomId=${encodeURIComponent(roomId)}`);
    esRef.current = es;

    const onMsg = (e: MessageEvent) => {
      if (!e.data) return;
      try {
        const obj = JSON.parse(e.data);

        // grouped frame
        if (obj && typeof obj === 'object' && ('hr' in obj || 'spo2' in obj || 'bp' in obj || 'glucose' in obj || 'rr' in obj || 'temp' in obj || 'tempC' in obj)) {
          const ts = Number(obj.ts ?? Date.now());
          const g: GroupedVitals = {
            ts,
            hr: n(obj.hr),
            spo2: n(obj.spo2),
            rr: n(obj.rr),
            tempC: n(obj.tempC ?? obj.temp),
            glucose: n(obj.glucose),
            bp: obj.bp && (Number.isFinite(obj.bp.sys) || Number.isFinite(obj.bp.dia))
              ? { sys: n(obj.bp.sys), dia: n(obj.bp.dia) }
              : undefined,
          };

          setLatest(g);
          setBuffer(a => {
            const next = [...a, g];
            while (next.length > maxPoints) next.shift();
            return next;
          });
          expand(g);
          return;
        }

        // single metric `{ type, value, ts }`
        if (obj && typeof obj.type === 'string' && Number.isFinite(obj.value)) {
          const t = Number(obj.ts ?? Date.now());
          const type = (obj.type as string).toLowerCase();
          const val = Number(obj.value);
          push(type, val, t);
          setLatest(prev => merge(prev, type, val, t));
        }
      } catch {/* ignore bad frames */}
    };

    es.addEventListener('vitals', onMsg as any);
    es.addEventListener('message', onMsg as any);
    es.onerror = () => { /* silent retry */ };

    return () => { try { es.close(); } catch {} };
  }, [roomId, maxPoints]);

  function n(x: any): number | undefined { return typeof x === 'number' && Number.isFinite(x) ? x : undefined; }
  function push(type: string, value: number, t: number) {
    setSamples(a => {
      const next = [...a, { t, type, value }];
      while (next.length > maxPoints * 6) next.shift();
      return next;
    });
  }
  function expand(g: GroupedVitals) {
    const t = g.ts;
    const p = (k: string, v?: number) => { if (Number.isFinite(v!)) push(k, v!, t); };
    p('hr', g.hr); p('spo2', g.spo2); p('rr', g.rr); p('temp', g.tempC ?? g.temp); p('glucose', g.glucose);
    if (g.bp?.sys != null) push('bp_sys', g.bp.sys!, t);
    if (g.bp?.dia != null) push('bp_dia', g.bp.dia!, t);
  }
  function merge(prev: GroupedVitals | null, type: string, value: number, t: number): GroupedVitals {
    const g = { ...(prev || { ts: t }), ts: t } as GroupedVitals;
    switch (type) {
      case 'hr': g.hr = value; break;
      case 'spo2': g.spo2 = value; break;
      case 'rr': g.rr = value; break;
      case 'temp': case 'tempc': case 'temp_c': g.tempC = value; break;
      case 'glucose': g.glucose = value; break;
      case 'bp_sys': g.bp = { ...(g.bp || {}), sys: value }; break;
      case 'bp_dia': g.bp = { ...(g.bp || {}), dia: value }; break;
    }
    return g;
  }

  return { latest, buffer, samples };
}

export default function useVitalsSSE(roomId: string, maxPoints?: number) { return _use(roomId, maxPoints); }
// named export too (back-compat)
export function useVitalsSSECompat(roomId: string, maxPoints?: number) { return _use(roomId, maxPoints); }
