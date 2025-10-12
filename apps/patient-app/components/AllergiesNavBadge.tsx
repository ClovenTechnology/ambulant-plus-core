'use client';
import React, { useEffect, useState } from 'react';

type Allergy = { status: 'Active' | 'Resolved' };

export default function AllergiesNavBadge() {
  const [n, setN] = useState(0);

  async function load() {
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const d: Allergy[] = await r.json();
      setN(d.filter(a => a.status === 'Active').length);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  if (n <= 0) return null;

  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-amber-600 text-white text-[10px] font-medium px-1.5 py-0.5 leading-none">
      {n}
    </span>
  );
}
