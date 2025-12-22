// apps/patient-app/app/sfu/[roomId]/useSessionEnd.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type WrapUpState = { show: boolean; seconds: number };

function fmtElapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export function useSessionEnd(roomId: string) {
  const [whenIso, setWhenIso] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<string>('00:00');
  const [wrapUp, setWrapUp] = useState<WrapUpState>({ show: false, seconds: 0 });

  useEffect(() => {
    setWhenIso(new Date().toISOString());
    setStartTime(null);
    setElapsed('00:00');
    setWrapUp({ show: false, seconds: 0 });
  }, [roomId]);

  useEffect(() => {
    if (!startTime) return;
    const t = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(fmtElapsed(secs));
    }, 1000);
    return () => window.clearInterval(t);
  }, [startTime]);

  const markStarted = useCallback(() => {
    setWrapUp({ show: false, seconds: 0 });
    setStartTime(Date.now());
  }, []);

  const markEnded = useCallback(() => {
    const secs = startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : 0;
    setStartTime(null);
    setElapsed('00:00');
    setWrapUp({ show: true, seconds: secs });
    return secs;
  }, [startTime]);

  const closeWrapUp = useCallback(() => setWrapUp({ show: false, seconds: 0 }), []);

  const apptWhen = useMemo(() => whenIso, [whenIso]);

  return { apptWhen, elapsed, wrapUp, closeWrapUp, markStarted, markEnded };
}
