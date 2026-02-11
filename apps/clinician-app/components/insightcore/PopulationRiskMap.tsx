//apps/clinician-app/components/insightcore/PopulationRiskMap.tsx
'use client';

import { useEffect, useState } from 'react';
import { eventBus } from '@/app/insightcore/services/event-bus';
import clsx from 'clsx';

type ZoneRisk = {
  zone: string;
  population: number;
  riskScore: number; // 0–100
  trend: 'up' | 'stable' | 'down';
};

export default function PopulationRiskMap() {
  const [zones, setZones] = useState<ZoneRisk[]>([]);

  useEffect(() => {
    function onRisk(data: ZoneRisk[]) {
      setZones(data);
    }

    eventBus.on('POPULATION_RISK', onRisk);
    return () => {
      eventBus.off('POPULATION_RISK', onRisk);
    };
  }, []);

  return (
    <div className="border rounded bg-white p-3 space-y-3">
      <h3 className="font-medium text-slate-800">Population Risk Map</h3>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
        {zones.map((z) => (
          <div
            key={z.zone}
            className={clsx(
              'p-3 rounded border text-sm space-y-1',
              z.riskScore > 80 && 'bg-red-50 border-red-400',
              z.riskScore > 60 && z.riskScore <= 80 && 'bg-amber-50 border-amber-400',
              z.riskScore > 40 && z.riskScore <= 60 && 'bg-yellow-50 border-yellow-400',
              z.riskScore <= 40 && 'bg-green-50 border-green-400',
            )}
          >
            <div className="font-medium">{z.zone}</div>
            <div className="text-xs text-gray-600">Population: {z.population}</div>
            <div className="text-xs">Risk Score: {z.riskScore}</div>
            <div className="text-xs">
              Trend: {z.trend === 'up' ? '↑' : z.trend === 'down' ? '↓' : '→'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
