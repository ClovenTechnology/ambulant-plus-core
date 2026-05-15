// apps/clinician-app/lib/insightcore/services/insight-generator/basic.ts

import type {
  Insight,
  InferenceOutput,
} from '@/lib/insightcore/contracts';
import { eventBus } from '@/app/insightcore/services/event-bus';

type BasicInsightGeneratorContract = {
  generate(inferences: InferenceOutput[]): Promise<Insight[]>;
};

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const BasicInsightGenerator: BasicInsightGeneratorContract = {
  async generate(inferences: InferenceOutput[]) {
    const insights: Insight[] = [];

    for (const inf of inferences) {
      const insight: Insight = {
        id: makeId('insight'),
        patientId: inf.patientId,
        title: `Clinical risk detected: ${inf.model}`,
        explanation: `Model ${inf.model} detected abnormal patterns in patient vitals`,
        evidence: Object.keys(inf.output),
        confidence: inf.confidence,
        sourceModels: [inf.model],
        recommendedActions: [
          'Review patient vitals',
          'Validate device readings',
          'Consider clinical assessment',
        ],
        timestamp: new Date().toISOString(),
      };

      insights.push(insight);
    }

    for (const insight of insights) {
      eventBus.emit('INSIGHT_GENERATED', {
        id: makeId('event'),
        type: 'INSIGHT_GENERATED',
        entityId: insight.id,
        source: 'insight-generator',
        timestamp: new Date().toISOString(),
        data: insight,
      });
    }

    return insights;
  },
};
