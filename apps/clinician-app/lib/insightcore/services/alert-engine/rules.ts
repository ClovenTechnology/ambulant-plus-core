// apps/clinician-app/lib/insightcore/services/alert-engine/rules.ts

import type {
  Alert,
  InferenceOutput,
} from '@/lib/insightcore/contracts';
import { eventBus } from '@/app/insightcore/services/event-bus';

type RuleEvaluator = {
  evaluate(inferences: InferenceOutput[]): Promise<Alert[]>;
};

type AlertCreatedEvent = {
  type: 'ALERT_CREATED';
  entityId: string;
  source: string;
  timestamp: string;
  data: Alert;
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const RuleAlertEngine: RuleEvaluator = {
  async evaluate(inferences: InferenceOutput[]) {
    const alerts: Alert[] = [];

    for (const inf of inferences) {
      if (inf.model === 'cardiac-risk-model') {
        alerts.push({
          id: makeId('alert'),
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
          id: makeId('alert'),
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
      const event: AlertCreatedEvent = {
        type: 'ALERT_CREATED',
        entityId: alert.id,
        source: 'alert-engine',
        timestamp: new Date().toISOString(),
        data: alert,
      };

      eventBus.emit('ALERT_CREATED', event);
    }

    return alerts;
  },
};
