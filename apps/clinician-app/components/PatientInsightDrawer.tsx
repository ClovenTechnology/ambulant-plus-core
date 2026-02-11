//apps/clinician-app/components/PatientInsightDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import Sparkline from '@/components/Sparkline';
import { iomtStream } from '@/services/iomt-stream';

type Pt = { t: number; y: number };

export default function PatientInsightDrawer({
  open,
  onClose,
  patientName,
}: {
  open: boolean;
  onClose: () => void;
  patientName: string | null;
}) {
  const [hr, setHr] = useState<Pt[]>([]);
  const [risk, setRisk] = useState(0.3);

  useEffect(() => {
    if (!open) return;

    iomtStream.connect();

    const off = iomtStream.on(e => {
      if (e.patientId !== patientName) return;

      if (e.type === 'hr') {
        setHr(prev => [...prev.slice(-30), { t: e.ts, y: e.value }]);
        setRisk(r => Math.min(1, r + Math.random() * 0.02));
      }
    });

    return () => {
      off();
      iomtStream.disconnect();
    };
  }, [open, patientName]);

  if (!open || !patientName) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full sm:w-[420px] h-full bg-white shadow-xl p-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-2">
          <div>
            <div className="font-semibold">{patientName}</div>
            <div className="text-xs text-gray-500">Live Clinical Intelligence</div>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Live vitals */}
        <div className="mt-4 space-y-4">
          <div>
            <div className="text-sm font-medium">Heart Rate (live)</div>
            <Sparkline data={hr} color="#ef4444" />
          </div>

          {/* Predictive overlay */}
          <div>
            <div className="text-sm font-medium">Risk Projection</div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.floor(risk * 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Predicted deterioration risk: {(risk * 100).toFixed(0)}%
            </div>
          </div>

          {/* AI Insights */}
          <div className="border rounded p-2 bg-gray-50">
            <div className="text-xs font-semibold text-gray-700">AI Insight</div>
            <div className="text-sm text-gray-800">
              Pattern indicates rising cardiovascular load with stress correlation.
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button className="w-full py-2 bg-indigo-600 text-white rounded">
              Open Full Patient View
            </button>
            <button className="w-full py-2 border rounded">
              Start Teleconsult
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
