'use client';

import { useEffect, useMemo, useState } from 'react';

type Payload = {
  encounterId?: string;
  roomId?: string;
  patient?: { id?: string; name?: string };
  clinician?: { id?: string; name?: string };
  notes?: any;
  ts?: string;
};

export default function EncounterHandoffBanner() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [visible, setVisible] = useState(false);

  const encKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('enc');
  }, []);

  useEffect(() => {
    if (!encKey || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(encKey);
      if (!raw) return;
      const data = JSON.parse(raw) as Payload;
      setPayload(data);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    } catch {}
  }, [encKey]);

  if (!visible || !payload) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 shadow">
        <div className="text-sm font-medium">
          Encounter loaded
          {payload.patient?.name ? ` · ${payload.patient.name}` : ''}
          {payload.clinician?.name ? ` → ${payload.clinician.name}` : ''}
        </div>
        <div className="text-[11px] opacity-80">
          {payload.encounterId || ''} {payload.roomId ? `· Room ${payload.roomId}` : ''}
        </div>
      </div>
    </div>
  );
}
