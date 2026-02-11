// apps/clinician-app/app/insightcore/services/hooks/useInsightsFeed.ts
'use client';

import { useEffect, useState } from 'react';
import { EventBus } from '../event-bus';

export type Insight = {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  confidence: number;
  sourceModel: string;
  timestamp: number;
};

export function useInsightsFeed() {
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    const handler = (insight: Insight) => {
      setInsights(prev => [insight, ...prev].slice(0, 50));
    };

    EventBus.on('INSIGHT_GENERATED', handler);
    return () => {
      EventBus.off('INSIGHT_GENERATED', handler);
    };
  }, []);

  return insights;
}
