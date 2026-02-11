// apps/clinician-app/app/insightcore/services/hooks/usePriorityFeed.ts
'use client';

import { useEffect, useState } from 'react';
import { EventBus } from '../event-bus';

type PriorityCase = {
  patientId: string;
  priorityScore: number;
  reasons: string[];
  lastUpdate: number;
};

export function usePriorityFeed() {
  const [queue, setQueue] = useState<PriorityCase[]>([]);

  useEffect(() => {
    const handler = (p: PriorityCase) => {
      setQueue(prev => {
        const filtered = prev.filter(x => x.patientId !== p.patientId);
        return [...filtered, p].sort((a,b) => b.priorityScore - a.priorityScore).slice(0, 50);
      });
    };

    EventBus.on('PRIORITY_UPDATED', handler);
    return () => EventBus.off('PRIORITY_UPDATED', handler);
  }, []);

  return queue;
}
