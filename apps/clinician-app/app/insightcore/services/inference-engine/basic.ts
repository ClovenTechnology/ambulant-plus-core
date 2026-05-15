// apps/clinician-app/app/insightcore/services/inference-engine/basic.ts
import type { InferenceOutput } from '@/lib/insightcore/contracts';
import { eventBus } from '../event-bus';

type InferenceEngine = {
  run(patientId: string, vitals: Record<string, any>): Promise<InferenceOutput[]>;
};

function uuid(prefix = 'inference') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const BasicInferenceEngine: InferenceEngine = {
  async run(patientId: string, vitals: Record<string, any>) {
    const outputs: InferenceOutput[] = [];

    if (vitals.hr && vitals.hr > 110) {
      outputs.push({
        patientId,
        model: 'cardiac-risk-model',
        output: { tachycardia: vitals.hr },
        confidence: 0.82,
        timestamp: new Date().toISOString(),
      });
    }

    if (vitals.spo2 && vitals.spo2 < 94) {
      outputs.push({
        patientId,
        model: 'respiratory-risk-model',
        output: { hypoxia: vitals.spo2 },
        confidence: 0.88,
        timestamp: new Date().toISOString(),
      });
    }

    for (const inf of outputs) {
      eventBus.emit('INFERENCE_READY', {
        id: uuid(),
        type: 'INFERENCE_READY',
        entityId: patientId,
        source: 'inference-engine',
        timestamp: new Date().toISOString(),
        data: inf,
      });
    }

    return outputs;
  },
};