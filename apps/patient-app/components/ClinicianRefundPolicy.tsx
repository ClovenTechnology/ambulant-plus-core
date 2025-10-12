'use client';
import { useEffect, useState } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type Refunds = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

export default function ClinicianRefundPolicy({ clinicianId }: { clinicianId: string }) {
  const [r, setR] = useState<Refunds | null>(null);
  useEffect(() => {
    fetch(`${GATEWAY}/api/clinicians/${encodeURIComponent(clinicianId)}/refunds`, { cache: 'no-store' })
      .then(res => res.json()).then(setR).catch(() => setR(null));
  }, [clinicianId]);

  if (!r) return null;

  return (
    <section className="border rounded p-3 bg-white">
      <div className="text-sm font-medium mb-1">Refund Policy</div>
      <ul className="text-sm space-y-1">
        <li>Cancel &lt; 24h: <b>{r.within24hPercent}%</b> refunded</li>
        <li>No-show: <b>{r.noShowPercent}%</b> refunded</li>
        <li>Clinician misses: <b>{r.clinicianMissPercent}%</b> refunded</li>
        <li>Network interrupted: {r.networkProrate ? <b>Prorated</b> : <b>No prorate</b>}</li>
      </ul>
    </section>
  );
}
