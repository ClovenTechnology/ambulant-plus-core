/services/alert-engine/index.ts
import { Alert, InferenceOutput } from '@/lib/insightcore/contracts';

export interface AlertEngine {
  evaluate(inference: InferenceOutput[]): Alert[];
}
