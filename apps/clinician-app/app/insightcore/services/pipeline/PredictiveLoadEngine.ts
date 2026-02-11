//apps/clinician-app/app/insightcore/services/pipeline/PredictiveLoadEngine.ts
import { EventEmitter } from 'events';
import { eventBus } from '../event-bus';

type LoadSignal = {
  zone: string;
  predictedLoad: number;
  confidence: number;
  window: '1h' | '6h' | '24h';
};

class PredictiveLoadEngine extends EventEmitter {
  push(signal: LoadSignal) {
    this.emit('PREDICTIVE_LOAD', signal);
    eventBus.emit('PREDICTIVE_LOAD', signal);
  }
}

export const predictiveLoadEngine = new PredictiveLoadEngine();

/**
 * Input sources:
 * - IoMT streams
 * - alert-engine
 * - inference-engine
 * - insight-generator
 */
eventBus.on('IOMT_STREAM', (data) => {
  // simple deterministic model placeholder
  if (data.risk === 'high' || data.risk === 'critical') {
    predictiveLoadEngine.push({
      zone: data.ward || 'General',
      predictedLoad: Math.floor(Math.random() * 40) + 60,
      confidence: 0.7 + Math.random() * 0.25,
      window: '6h',
    });
  }
});
