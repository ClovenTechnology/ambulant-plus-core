// apps/patient-app/app/myCare/devices/otoscope/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Otoscope } from '@/hooks/otoscope-plugin';

type Telemetry = { connected: boolean; usbProduct?: string; message?: string; width?: number; height?: number };

function isNative() {
  try {
    // @ts-expect-error window check
    const C = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
    return !!C && (C.isNativePlatform?.() || C.isNative);
  } catch {
    return false;
  }
}

export default function OtoscopeConsole() {
  const [tel, setTel] = useState<Telemetry>({ connected: false });
  const [log, setLog] = useState<string[]>([]);
  const [native, setNative] = useState<boolean>(false);
  const push = (s: string) => setLog((L) => [`${new Date().toLocaleTimeString()}  ${s}`, ...L].slice(0, 300));

  useEffect(() => {
    const n = isNative();
    setNative(n);
    if (!n) {
      push('Running on web — Otoscope native plugin unavailable. Use Android device with USB-OTG.');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        await Otoscope.askPermissions();
      } catch {}
      const sub = await Otoscope.addListener('telemetry', (e) => {
        if (!mounted) return;
        setTel({
          connected: !!(e as any)?.connected,
          usbProduct: (e as any)?.usbProduct,
          message: (e as any)?.message,
          width: (e as any)?.width,
          height: (e as any)?.height,
        });
        push(`telemetry: ${JSON.stringify(e)}`);
      });
      return () => sub.remove();
    })();

    return () => {
      try {
        // @ts-ignore
        Otoscope.stopPreview?.();
      } catch {}
      try {
        // @ts-ignore
        Otoscope.close?.();
      } catch {}
    };
  }, []);

  const open = async () => {
    if (!native) return;
    // @ts-ignore
    await Otoscope.open();
    push('open()');
  };
  const close = async () => {
    if (!native) return;
    // @ts-ignore
    await Otoscope.close();
    push('close()');
  };
  const startPreview = async () => {
    if (!native) return;
    // @ts-ignore
    await Otoscope.startPreview({ width: 1280, height: 720, fps: 30 });
    push('startPreview()');
  };
  const stopPreview = async () => {
    if (!native) return;
    // @ts-ignore
    await Otoscope.stopPreview();
    push('stopPreview()');
  };
  const snap = async () => {
    if (!native) return;
    // @ts-ignore
    const r = await Otoscope.capturePhoto({ quality: 0.9 });
    push(`capturePhoto() → ${r.fileUrl || ''}`);
    if (r.fileUrl) window.open(r.fileUrl, '_blank');
  };
  const recStart = async () => {
    if (!native) return;
    // @ts-ignore
    await Otoscope.startRecording({ container: 'mp4', maxSeconds: 120 });
    push('startRecording()');
  };
  const recStop = async () => {
    if (!native) return;
    // @ts-ignore
    const r = await Otoscope.stopRecording();
    push(`stopRecording() → ${r.fileUrl || ''}`);
    if (r.fileUrl) window.open(r.fileUrl, '_blank');
  };

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">HD Otoscope (UVC)</h1>
        <div className="text-xs rounded px-2 py-1 border bg-white">
          {tel.connected ? 'Connected' : 'Disconnected'} {tel.usbProduct ? `· ${tel.usbProduct}` : ''}
          {tel.width ? ` · ${tel.width}×${tel.height}` : ''}
        </div>
      </header>

      {!native && (
        <div className="rounded-xl border bg-amber-50 text-amber-900 p-3 text-sm">
          This page requires the native Android app. Build & run on a device with USB-OTG, then connect the otoscope.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={open} className="px-3 py-1.5 border rounded bg-white" disabled={!native}>
          Open
        </button>
        <button onClick={startPreview} className="px-3 py-1.5 border rounded bg-white" disabled={!native || !tel.connected}>
          Start Preview
        </button>
        <button onClick={stopPreview} className="px-3 py-1.5 border rounded bg-white" disabled={!native || !tel.connected}>
          Stop Preview
        </button>
        <button onClick={snap} className="px-3 py-1.5 border rounded bg-white" disabled={!native || !tel.connected}>
          Capture Photo
        </button>
        <button onClick={recStart} className="px-3 py-1.5 border rounded bg-white" disabled={!native || !tel.connected}>
          Start Rec
        </button>
        <button onClick={recStop} className="px-3 py-1.5 border rounded bg-white" disabled={!native || !tel.connected}>
          Stop Rec
        </button>
        <button onClick={close} className="px-3 py-1.5 border rounded bg-white" disabled={!native}>
          Close
        </button>
      </div>

      <div className="text-xs text-slate-600">
        Preview is native-side in this minimal binding. We’ll wire a JS thumbnail stream once the vendor SDK API is confirmed.
      </div>

      <pre className="text-xs bg-white border rounded p-3 h-64 overflow-auto whitespace-pre-wrap">{log.join('\n')}</pre>
    </main>
  );
}
