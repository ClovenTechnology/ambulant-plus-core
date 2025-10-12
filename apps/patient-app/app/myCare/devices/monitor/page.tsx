// apps/patient-app/app/myCare/devices/monitor/page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function MonitorOverlayDemo() {
  const [hr, setHr] = useState<number | null>(null);
  const [ppg, setPpg] = useState<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Dummy BLE subscription hook points – wire to your HM service when ready
  async function connect() {
    // TODO: call your HM BLE connect helper and set: setHr(x), setPpg(prev=>[...prev.slice(-128), v])
    // This page is a visual skeleton for integrating with your SFU HUD.
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Monitor Overlay</h1>
        <Link href="/televisit" className="text-sm underline">Go to Televisit</Link>
      </header>

      <div className="border rounded p-4 bg-white relative">
        {/* HUD card (drop this component into your televisit page near the video grid) */}
        <div className="absolute top-2 right-2 bg-black/70 text-white rounded px-3 py-2">
          <div className="text-xs opacity-80">Live Vitals</div>
          <div className="text-sm">HR: {hr ?? '—'} bpm</div>
        </div>

        <div className="text-sm mb-3">Demo canvas (PPG):</div>
        <canvas id="ppg" width={600} height={120} className="border rounded bg-white" />
        <div className="mt-3 flex gap-2">
          <button onClick={connect} className="px-3 py-2 border rounded bg-emerald-600 text-white">Connect</button>
        </div>
      </div>
    </main>
  );
}
