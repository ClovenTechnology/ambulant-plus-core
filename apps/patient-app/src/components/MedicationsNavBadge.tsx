'use client';
import React, { useEffect, useState } from 'react';

export default function MedicationsNavBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/medications', { cache: 'no-store' });
        const meds = await res.json();
        const active = meds.filter((m: any) => m.status === 'Active').length;
        if (mounted) setCount(active);
      } catch {
        if (mounted) setCount(null);
      }
    }
    load();
    const id = setInterval(load, 20_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (count == null) return <span className="ml-1 inline-block text-[10px] text-gray-400">•</span>;
  if (count === 0) return null;

  return (
    <span className="ml-1 inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
      {count}
    </span>
  );
}
