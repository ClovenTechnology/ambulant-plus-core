// apps/clinician-app/app/insightcore/services/hooks/useAlertsFeed.ts
'use client';

import { useEffect, useState } from 'react';
import { EventBus } from '../event-bus';

export type Alert = {
  id: string;
  patientId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
};

export function useAlertsFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const handler = (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50)); // bounded buffer
    };

    EventBus.on('ALERT_CREATED', handler);
    return () => {
      EventBus.off('ALERT_CREATED', handler);
    };
  }, []);

  return alerts;
}
