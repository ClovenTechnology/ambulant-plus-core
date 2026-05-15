// apps/clinician-app/app/insightcore/services/alert-engine/rules.ts
import type { Alert, InferenceOutput } from '@/lib/insightcore/contracts';
import type { AlertEngine } from './index';
import { eventBus } from '../event-bus';

function uuid(prefix = 'alert') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const RuleAlertEngine: AlertEngine = {
  evaluate(inferences: InferenceOutput[]) {
    const alerts: Alert[] = [];

    for (const inf of inferences) {
      if (inf.model === 'cardiac-risk-model') {
        alerts.push({
          id: uuid(),
          patientId: inf.patientId,
          type: 'Cardiac risk',
          severity: 'high',
          score: inf.confidence,
          source: 'model',
          timestamp: new Date().toISOString(),
          status: 'new',
        });
      }

      if (inf.model === 'respiratory-risk-model') {
        alerts.push({
          id: uuid(),
          patientId: inf.patientId,
          type: 'Respiratory risk',
          severity: 'critical',
          score: inf.confidence,
          source: 'model',
          timestamp: new Date().toISOString(),
          status: 'new',
        });
      }
    }

    for (const alert of alerts) {
      eventBus.emit('ALERT_CREATED', {
        type: 'ALERT_CREATED',
        entityId: alert.id,
        source: 'alert-engine',
        timestamp: new Date().toISOString(),
        data: alert,
      });
    }

    return alerts;
  },
};