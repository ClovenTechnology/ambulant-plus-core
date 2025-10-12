'use client';

import { useEffect, useState } from 'react';

type Health = { livekit: 'up' | 'down' } | null;

export default function HealthBadge({
  className = '',
  label = 'LiveKit',
}: { className?: string; label?: string }) {
  const [health, setHealth] = useState<Health>(null);

  useEffect(() => {
    let cancel = false;
    const fetchHealth = async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        const j = await r.json();
        if (!cancel) setHealth({ livekit: j.livekit === 'up' ? 'up' : 'down' });
      } catch {
        if (!cancel) setHealth({ livekit: 'down' });
      }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 10_000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  const state = health?.livekit ?? 'down';
  const color = state === 'up' ? 'bg-emerald-500' : 'bg-red-500';
  const text  = state === 'up' ? 'OK' : 'Down';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}
      title={`${label}: ${text}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-slate-700">{label}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-600">{text}</span>
    </span>
  );
}
