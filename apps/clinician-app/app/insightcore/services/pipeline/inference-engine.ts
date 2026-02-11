// apps/clinician-app/app/insightcore/services/pipeline/inference-engine.ts
import { Risk } from '../hooks/useRiskFeed';
import { EventEmitter } from 'events';

class InferenceEngine extends EventEmitter {
  onInference(callback: (risk: Risk) => void) {
    this.on('INFERENCE', callback);
  }

  emitInference(risk: Risk) {
    this.emit('INFERENCE', risk);
  }
}

export const inferenceEngine = new InferenceEngine();

// connect to real inference outputs
import { subscribeToInference } from '../sources/internal-inference-api';

subscribeToInference((data) => {
  inferenceEngine.emitInference(data);
});
