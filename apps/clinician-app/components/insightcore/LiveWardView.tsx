//apps/clinician-app/components/insightcore/LiveWardView.tsx
'use client';

import { useEffect, useState } from 'react';
import { eventBus } from '@/app/insightcore/services/event-bus';
import Sparkline from '@/components/Sparkline';
import clsx from 'clsx';

type LivePatient = {
  id: string;
  name: string;
  ward?: string;
  vitals: {
    hr?: number;
    spo2?: number;
    rr?: number;
  };
  trend: { t: number; y: number }[];
  risk: 'low' | 'moderate' | 'high' | 'critical';
};

export default function LiveWardView() {
  const [patients, setPatients] = useState<Record<string, LivePatient>>({});

  useEffect(() => {
    function onIoMT(data: any) {
      setPatients(prev => ({
        ...prev,
        [data.patientId]: {
          id: data.patientId,
          name: data.patientName,
          ward: data.ward,
          vitals: data.vitals,
          trend: data.trend || [],
          risk: data.risk || 'low',
        },
      }));
    }

    eventBus.on('IOMT_STREAM', onIoMT);
    return () => {
      eventBus.off('IOMT_STREAM', onIoMT);
    };
  }, []);

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Object.values(patients).map((p) => (
        <div
          key={p.id}
          className={clsx(
            'border rounded p-3 space-y-2 bg-white',
            p.risk === 'critical' && 'border-red-600',
            p.risk === 'high' && 'border-amber-500',
            p.risk === 'moderate' && 'border-yellow-400',
          )}
        >
          <div className="flex justify-between items-center">
            <div className="font-medium">{p.name}</div>
            <span className="text-xs text-gray-500">{p.ward || 'Live feed'}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>HR: {p.vitals.hr ?? '--'}</div>
            <div>SpO₂: {p.vitals.spo2 ?? '--'}%</div>
            <div>RR: {p.vitals.rr ?? '--'}</div>
          </div>

          <Sparkline data={p.trend} height={48} />

          <div className="text-xs text-gray-500">
            Risk: <span className="font-medium capitalize">{p.risk}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
