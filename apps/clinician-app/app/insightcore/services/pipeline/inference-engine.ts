// apps/clinician-app/app/insightcore/services/pipeline/inference-engine.ts
import { EventEmitter } from 'events';
import type { Risk } from '../hooks/useRiskFeed';
import { subscribeToInference } from '../sources/internal-inference-api';

type InferencePayload = Record<string, any>;

function makeId(prefix = 'risk') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normaliseInferenceToRisk(payload: InferencePayload): Risk {
  const output =
    payload?.output && typeof payload.output === 'object'
      ? payload.output
      : {};

  const rawScore =
    payload?.score ??
    payload?.riskScore ??
    payload?.confidence ??
    output.score ??
    output.riskScore ??
    0;

  const numericScore = Number(rawScore);
  const score = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(1, numericScore))
    : 0;

  const category = String(
    payload?.category ??
      payload?.type ??
      payload?.model ??
      payload?.riskCategory ??
      'inference',
  );

  return {
    ...payload,
    id: String(payload?.id ?? payload?.riskId ?? makeId()),
    score,
    category,
  } as Risk;
}

class InferenceEngine extends EventEmitter {
  onInference(callback: (risk: Risk) => void) {
    this.on('INFERENCE', callback);
  }

  emitInference(risk: Risk) {
    this.emit('INFERENCE', risk);
  }
}

export const inferenceEngine = new InferenceEngine();

// Connect to real inference outputs and normalise them into Risk feed shape.
subscribeToInference((data) => {
  inferenceEngine.emitInference(normaliseInferenceToRisk(data as InferencePayload));
});
