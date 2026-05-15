// apps/clinician-app/lib/insightcore/services/inference-engine/basic.ts

import type { InferenceOutput } from '@/lib/insightcore/contracts';
import { eventBus } from '@/app/insightcore/services/event-bus';

type BasicInferenceEngineContract = {
  run(patientId: string, vitals: Record<string, unknown>): Promise<InferenceOutput[]>;
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export const BasicInferenceEngine: BasicInferenceEngineContract = {
  async run(patientId: string, vitals: Record<string, unknown>) {
    const outputs: InferenceOutput[] = [];

    const hr = asNumber(vitals.hr);
    const spo2 = asNumber(vitals.spo2);

    if (typeof hr === 'number' && hr > 110) {
      outputs.push({
        patientId,
        model: 'cardiac-risk-model',
        output: { tachycardia: hr },
        confidence: 0.82,
        timestamp: new Date().toISOString(),
      });
    }

    if (typeof spo2 === 'number' && spo2 < 94) {
      outputs.push({
        patientId,
        model: 'respiratory-risk-model',
        output: { hypoxia: spo2 },
        confidence: 0.88,
        timestamp: new Date().toISOString(),
      });
    }

    for (const inf of outputs) {
      eventBus.emit('INFERENCE_READY', {
        id: makeId('event'),
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
