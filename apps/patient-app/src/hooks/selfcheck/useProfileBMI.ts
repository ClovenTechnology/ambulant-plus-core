'use client';

import { useEffect, useState } from 'react';

export default function useProfileBMI() {
  const [bmi, setBmi] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const r = await fetch('/api/profile', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json().catch(() => ({}));
        if (!mounted) return;

        const h = Number(j.heightCm) || null;
        const w = Number(j.weightKg) || null;

        if (h && w) {
          const computed = w / ((h / 100) ** 2);
          setBmi(Number(computed.toFixed(1)));
        } else setBmi(null);
      } catch {
        setBmi(null);
      }
    })();

    return () => { mounted = false; };
  }, []);

  return bmi;
}
