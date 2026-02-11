//apps/clinician-app/app/clinical-command-center/page.tsx
'use client';

import LiveWardView from '@/components/insightcore/LiveWardView';
import PopulationRiskMap from '@/components/insightcore/PopulationRiskMap';
import { useEffect, useState } from 'react';
import { eventBus } from '@/app/insightcore/services/event-bus';

type LoadSignal = {
  zone: string;
  predictedLoad: number;
  confidence: number;
  window: string;
};

export default function ClinicalCommandCenter() {
  const [loadSignals, setLoadSignals] = useState<LoadSignal[]>([]);

  useEffect(() => {
    function onLoad(signal: LoadSignal) {
      setLoadSignals(prev => [signal, ...prev].slice(0, 10));
    }

    eventBus.on('PREDICTIVE_LOAD', onLoad);
    return () => {
      eventBus.off('PREDICTIVE_LOAD', onLoad);
    };
  }, []);

  return (
    <main className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Clinical Command Center</h1>
        <span className="text-sm text-gray-500">InsightCore Operational Intelligence</span>
      </header>

      {/* Top Layer */}
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <LiveWardView />
        </div>

        <div className="space-y-3">
          <PopulationRiskMap />

          <div className="border rounded bg-white p-3">
            <h3 className="font-medium">Predictive Load Forecast</h3>
            <div className="space-y-2 mt-2 text-sm">
              {loadSignals.map((l, i) => (
                <div key={i} className="border rounded p-2">
                  <div className="font-medium">{l.zone}</div>
                  <div>Load: {l.predictedLoad}%</div>
                  <div className="text-xs text-gray-500">
                    Window: {l.window} • Confidence: {(l.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
              {loadSignals.length === 0 && (
                <div className="text-xs text-gray-400">No predictive load signals yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
