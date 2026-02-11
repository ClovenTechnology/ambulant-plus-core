// apps/clinician-app/app/insightcore/services/live-bridge.ts
import { EventBus } from './event-bus';
import { alertEngine } from './pipeline/alert-engine';
import { inferenceEngine } from './pipeline/inference-engine';
import { insightGenerator } from './pipeline/insight-generator';

let started = false;

export function startLiveBridge() {
  if (started) return;
  started = true;

  // ALERTS → EventBus
  alertEngine.onAlert((alert) => {
    EventBus.emit('ALERT_CREATED', alert);
  });

  // INFERENCES → EventBus
  inferenceEngine.onInference((risk) => {
    EventBus.emit('INFERENCE_READY', risk);
  });

  // AI insights → EventBus
  insightGenerator.onInsight((insight) => {
    EventBus.emit('INSIGHT_GENERATED', insight);
  });

  console.log('[LiveBridge] Connected real engines to EventBus');
}
