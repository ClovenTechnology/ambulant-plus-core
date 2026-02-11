// services/inference-engine/basic.ts
import { InferenceEngine } from './index';
import { InferenceOutput } from '@/lib/insightcore/contracts';
import { eventBus } from '@/services/event-bus';
import { v4 as uuid } from 'uuid';

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
      await eventBus.publish({
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
