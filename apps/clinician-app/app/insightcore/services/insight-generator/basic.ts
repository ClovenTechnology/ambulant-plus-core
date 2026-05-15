// apps/clinician-app/app/insightcore/services/insight-generator/basic.ts
import type { Insight, InferenceOutput } from '@/lib/insightcore/contracts';
import { eventBus } from '../event-bus';

type InsightGenerator = {
  generate(inferences: InferenceOutput[]): Promise<Insight[]>;
};

function uuid(prefix = 'insight') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const BasicInsightGenerator: InsightGenerator = {
  async generate(inferences: InferenceOutput[]) {
    const insights: Insight[] = [];

    for (const inf of inferences) {
      insights.push({
        id: uuid(),
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
      });
    }

    for (const insight of insights) {
      eventBus.emit('INSIGHT_GENERATED', {
        id: uuid(),
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