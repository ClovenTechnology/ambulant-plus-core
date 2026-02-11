// apps/clinician-app/app/insightcore/services/pipeline/insight-generator.ts
import { Insight } from '../hooks/useInsightsFeed';
import { EventEmitter } from 'events';

class InsightGenerator extends EventEmitter {
  onInsight(callback: (insight: Insight) => void) {
    this.on('INSIGHT', callback);
  }

  emitInsight(insight: Insight) {
    this.emit('INSIGHT', insight);
  }
}

export const insightGenerator = new InsightGenerator();

// connect to the AI insight generator
import { subscribeToInsights } from '../sources/internal-insights-api';

subscribeToInsights((data) => {
  insightGenerator.emitInsight(data);
});
