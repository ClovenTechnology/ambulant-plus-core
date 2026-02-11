// services/insight-generator/basic.ts
import { InsightGenerator } from './index';
import { Insight, InferenceOutput } from '@/lib/insightcore/contracts';
import { eventBus } from '@/services/event-bus';
import { v4 as uuid } from 'uuid';

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
      await eventBus.publish({
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
