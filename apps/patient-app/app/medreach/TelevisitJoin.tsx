'use client';

import { useEffect, useState } from 'react';

export default function TelevisitJoin() {
  const [status, setStatus] = useState<'idle' | 'open' | 'closed'>('idle');
  const [ticket, setTicket] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/televisit/status', { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        setStatus(json?.joinWindow?.open ? 'open' : 'closed');
        setTicket(json?.ticket ?? null);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="text-sm text-gray-500">Televisit</div>
      <div className="text-lg font-semibold mt-1">
        {status === 'open' ? 'Join window is OPEN' : 'Join window is CLOSED'}
      </div>
      <div className="text-xs text-gray-500 mt-1">{ticket ? `Ticket: ${ticket}` : 'No ticket yet'}</div>
    </div>
  );
}
