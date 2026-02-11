//apps/clinician-app/components/insightcore/LivePulse.tsx
'use client';
import { useEffect, useState } from 'react';

export function LivePulse({ active }: { active: boolean }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setPulse(p => !p), 900);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div className="relative w-2 h-2">
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${
          active ? 'bg-green-500' : 'bg-gray-300'
        } ${pulse ? 'animate-ping' : ''}`}
      />
      <span
        className={`relative inline-flex rounded-full h-2 w-2 ${
          active ? 'bg-green-600' : 'bg-gray-400'
        }`}
      />
    </div>
  );
}
