// apps/clinician-app/app/insightcore/services/hooks/useRiskFeed.ts
'use client';

import { useEffect, useState } from 'react';
import { EventBus } from '../event-bus';

export type Risk = {
  id: string;
  patientId: string;
  score: number;
  category: string;
  model: string;
  timestamp: number;
};

export function useRiskFeed() {
  const [risks, setRisks] = useState<Risk[]>([]);

  useEffect(() => {
    const handler = (risk: Risk) => {
      setRisks(prev => [risk, ...prev].slice(0, 50));
    };

    EventBus.on('INFERENCE_READY', handler);
    return () => {
      EventBus.off('INFERENCE_READY', handler);
    };
  }, []);

  return risks;
}
