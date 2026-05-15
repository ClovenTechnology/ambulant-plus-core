// apps/clinician-app/app/insightcore/services/pipeline/insight-generator.ts
import { EventEmitter } from 'events';
import type { Insight } from '../hooks/useInsightsFeed';
import { subscribeToInsights } from '../sources/internal-insights-api';

type InsightPayload = Record<string, any>;

function makeId(prefix = 'insight') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalisePayloadToInsight(payload: InsightPayload): Insight {
  const model =
    payload?.sourceModel ??
    payload?.model ??
    payload?.sourceModels?.[0] ??
    payload?.source ??
    'insight-generator';

  const title =
    payload?.title ??
    payload?.name ??
    payload?.headline ??
    `Clinical insight: ${String(model)}`;

  const summary =
    payload?.summary ??
    payload?.explanation ??
    payload?.description ??
    payload?.message ??
    'Insight generated from clinical intelligence pipeline.';

  return {
    ...payload,
    id: String(payload?.id ?? payload?.insightId ?? makeId()),
    title: String(title),
    summary: String(summary),
    sourceModel: String(model),
  } as Insight;
}

class InsightGenerator extends EventEmitter {
  onInsight(callback: (insight: Insight) => void) {
    this.on('INSIGHT', callback);
  }

  emitInsight(insight: Insight) {
    this.emit('INSIGHT', insight);
  }
}

export const insightGenerator = new InsightGenerator();

// Connect to the AI insight generator and normalise payloads into Insight feed shape.
subscribeToInsights((data) => {
  insightGenerator.emitInsight(normalisePayloadToInsight(data as InsightPayload));
});