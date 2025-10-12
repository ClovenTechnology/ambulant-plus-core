// apps/patient-app/components/RefundPolicyPanel.tsx
'use client';
import { useEffect, useState } from 'react';
import { API, BASE } from '@/src/lib/config';

export default function RefundPolicyPanel({ clinicianId }: { clinicianId: string }) {
  const [text, setText] = useState<string>('Loading policy...');
  useEffect(() => {
    let alive = true;
    (async () => {
      const url = `${API || BASE}/api/clinicians/${encodeURIComponent(clinicianId)}/refund-policy`;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        const p = j?.effective
          ? `Cancels within 24h: ${j.effective.within24hPercent}% refunded\nNo-show: ${j.effective.noShowPercent}% refunded\nClinician cancels: ${j.effective.clinicianMissPercent}% refunded\nNetwork prorate: ${j.effective.networkProrate ? 'Yes' : 'No'}`
          : 'Refunds not available once consultation has started.';
        if (alive) setText(p);
      } catch (e:any) {
        if (alive) setText('Failed to load policy');
      }
    })();
    return () => { alive = false; };
  }, [clinicianId]);

  return <pre className="text-sm whitespace-pre-wrap">{text}</pre>;
}
