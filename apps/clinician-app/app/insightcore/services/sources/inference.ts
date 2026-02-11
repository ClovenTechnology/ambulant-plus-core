// apps/clinician-app/app/insightcore/services/sources/inference.ts
import { Risk } from '../hooks/useRiskFeed';

export function connectInferenceStream(onRisk: (r: Risk) => void) {
  setInterval(() => {
    const ts = new Date().toISOString();
    onRisk({
      patient: `Patient ${Math.ceil(Math.random() * 10)}`,
      level: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      reason: 'Elevated heart rate',
      score: Math.random(),
      ts,
    });
  }, 5000);
}
