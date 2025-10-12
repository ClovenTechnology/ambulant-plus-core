// apps/clinician-app/components/InboxBell.tsx
'use client';

import { useEffect, useState } from 'react';
import { CLIN } from '@/src/lib/config';

export default function InboxBell(props: {
  patientId?: string;
  clinicianId?: string;
  admin?: boolean;
}) {
  const { patientId, clinicianId, admin } = props;
  const [count, setCount] = useState(0);
  const [lastId, setLastId] = useState<string | undefined>();

  useEffect(() => {
    let stopped = false;

    async function poll() {
      // robust URL construction: fall back to window.location.origin when CLIN is not absolute
      const base = typeof CLIN === 'string' && CLIN.length ? CLIN : window.location.origin;
      const url = new URL('/api/events/inbox', base);

      if (patientId) url.searchParams.set('patientId', patientId);
      if (clinicianId) url.searchParams.set('clinicianId', clinicianId);
      if (admin) url.searchParams.set('admin', '1');
      if (lastId) url.searchParams.set('afterId', lastId);

      try {
        const r = await fetch(url.toString(), { cache: 'no-store' });
        if (r.ok) {
          const { events } = await r.json();
          if (Array.isArray(events) && events.length) {
            setCount(c => c + events.length);
            setLastId(events[events.length - 1].id);
          }
        }
      } catch {
        // ignore; retry
      }
      if (!stopped) setTimeout(poll, 3000);
    }

    poll();
    return () => { stopped = true; };
  }, [patientId, clinicianId, admin, lastId]);

  return (
    <button
      className="relative text-sm px-2 py-1 rounded border bg-white hover:bg-gray-50"
      onClick={() => setCount(0)}
      title="Notifications"
    >
      🔔
      {count > 0 && (
        <span className="absolute -top-1 -right-1 text-[10px] px-1 rounded-full bg-rose-600 text-white">
          {count}
        </span>
      )}
    </button>
  );
}
