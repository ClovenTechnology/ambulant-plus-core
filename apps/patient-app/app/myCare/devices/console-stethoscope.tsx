// apps/patient-app/app/myCare/devices/console-stethoscope.tsx (client)
'use client';
import { useEffect, useRef, useState } from 'react';
import { webBleConnect, subscribeNotify } from '@/src/lib/ble';
import { getAudioContext } from '@/devices/audioCtx';
import SERVICE_MAP from '@/src/devices/serviceMap'; // assume exists

export default function StethConsole({ catalogSlug, deviceId }: { catalogSlug: string; deviceId?: string }) {
  const [status, setStatus] = useState('idle');
  const unsubscribeRef = useRef<() => Promise<void> | null>(null);
  const cleanupRef = useRef<() => Promise<void> | null>(null);

  async function start() {
    setStatus('pairing');
    try {
      const filters = [{ services: [SERVICE_MAP.stethoscope.serviceUuid] }];
      const { device, server, cleanup, abortController } = await webBleConnect(filters);
      cleanupRef.current = cleanup;
      setStatus('connected');

      const audioCtx = getAudioContext();
      // get characteristic and stream PCM frames to WebAudio
      const unsub = await subscribeNotify(server, SERVICE_MAP.stethoscope.serviceUuid, SERVICE_MAP.stethoscope.pcmCharUuid, (dv) => {
        // decode PCM16 -> Float32 and play via AudioContext
        // forward frames to InsightCore via fetch('/api/insight/frame')
      });
      unsubscribeRef.current = unsub;

      // heartbeat: ping server to mark lastSeen
      const hb = setInterval(() => {
        fetch('/api/devices/heartbeat', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ deviceId: catalogSlug })});
      }, 30000);

      // Cleanup on unmount or abort
      abortController.signal.addEventListener('abort', () => { clearInterval(hb); });
    } catch (e:any) {
      setStatus('error: ' + e.message);
    }
  }

  useEffect(() => {
    return () => {
      // unmount cleanup
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
