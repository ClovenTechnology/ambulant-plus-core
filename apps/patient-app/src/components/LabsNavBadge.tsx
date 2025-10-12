// apps/patient-app/src/components/LabsNavBadge.tsx
'use client';
import React, { useEffect, useState } from 'react';

type LabRow = { status?: string };

export default function LabsNavBadge() {
  const [count, setCount] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/labs', { cache: 'no-store' });
      const rows: LabRow[] = await res.json();
      const done = rows.filter(r => (r.status ?? '').toLowerCase() === 'completed').length;
      setCount(done);
    } catch {
      setCount(null);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // poll every 15s
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="ml-1 inline-flex items-center justify-center rounded-full border bg-gray-50 px-1.5 h-5 min-w-[1.25rem] text-[10px]"
      title="Completed labs"
    >
      {count ?? '—'}
    </span>
  );
}
