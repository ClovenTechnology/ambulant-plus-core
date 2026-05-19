// apps/patient-app/app/myCare/devices/console-stethoscope.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

import { webBleConnect, subscribeNotify } from '@/src/lib/ble';
import { getAudioContext } from '@/src/devices/audioCtx';
import { serviceMap } from '@/src/devices/serviceMap';

type CleanupFn = () => Promise<void> | void;

const STETHOSCOPE_KEY = 'duecare.stethoscope';

export default function StethConsole({
  catalogSlug,
  deviceId,
}: {
  catalogSlug: string;
  deviceId?: string;
}) {
  const [status, setStatus] = useState('idle');

  const unsubscribeRef = useRef<CleanupFn | null>(null);
  const cleanupRef = useRef<CleanupFn | null>(null);

  async function start() {
    setStatus('pairing');

    try {
      const spec = serviceMap[STETHOSCOPE_KEY];

      const serviceUuid = spec.filters?.services?.[0];
      const pcmCharUuid = spec.characteristics?.pcm_stream?.uuid;

      if (!serviceUuid || !pcmCharUuid) {
        throw new Error('Stethoscope BLE service/PCM characteristic is not configured.');
      }

      const filters = [{ services: [serviceUuid] }];

      const { device, server, cleanup, abortController } = await webBleConnect(filters);

      void device;

      cleanupRef.current = cleanup;
      setStatus('connected');

      const audioCtx = getAudioContext();
      void audioCtx;

      const unsub = await subscribeNotify(server, serviceUuid, pcmCharUuid, (dv) => {
        void dv;
        // decode PCM16 -> Float32 and play via AudioContext
        // forward frames to InsightCore via fetch('/api/insight/frame')
      });

      unsubscribeRef.current = unsub;

      const hb = setInterval(() => {
        fetch('/api/devices/heartbeat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceId || catalogSlug }),
        });
      }, 30000);

      abortController.signal.addEventListener('abort', () => {
        clearInterval(hb);
      });
    } catch (e: any) {
      setStatus(`error: ${e?.message ?? 'Unknown error'}`);
    }
  }

  useEffect(() => {
    return () => {
      (async () => {
        if (unsubscribeRef.current) await unsubscribeRef.current();
        if (cleanupRef.current) await cleanupRef.current();
      })();
    };
  }, []);

  return (
    <div>
      <h3>Stethoscope console — {status}</h3>
      <button onClick={start}>Start Auscultation</button>
    </div>
  );
}