// apps/clinician-app/app/call-links/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MonitorPanel = dynamic(() => import('@ambulant/rtc').then(m => m.MonitorPanel), { ssr: false });

type Health = { ok: boolean; livekit: boolean; host: string; ts: number };

export default function CallLinksPage() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const r = await fetch('/api/healthz', { cache: 'no-store' });
        const j = await r.json();
        if (mounted) setHealth(j);
      } catch {
        if (mounted) setHealth({ ok: true, livekit: false, host: 'n/a', ts: Date.now() });
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const color = health?.livekit ? 'bg-emerald-500' : 'bg-red-500';
  const title = health?.livekit ? `LiveKit: UP (${health?.host})` : `LiveKit: DOWN (${health?.host || 'n/a'})`;

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-semibold mb-3">Call Links</h1>
      <MonitorPanel />

      {/* Tiny health badge, fixed & subtle, not in SFU pages */}
      <div
        className="fixed left-3 bottom-3 flex items-center gap-2 text-xs text-slate-600 select-none"
        title={title}
        aria-label={title}
      >
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="hidden sm:inline">
          {health?.livekit ? 'LiveKit OK' : 'LiveKit Unreachable'}
        </span>
      </div>
    </main>
  );
}
