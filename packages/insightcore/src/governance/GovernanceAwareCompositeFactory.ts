import { CompositeRiskEngine } from '../inference/CompositeRiskEngine';
import { ResolvedGovernance } from './ResolvedGovernance';
import type { OrgGovernanceBundle } from './OrgGovernanceProvider';

const DEFAULT_WEIGHTS = {
  sepsis_fever: 0.32,
  sepsis_tachy: 0.24,
  sepsis_diag: 0.18,
  sepsis_symptom: 0.12,
  sepsis_emergency: 0.12,
  sepsis_hydration: 0.05,
  cardio_bp: 0.26,
  cardio_tachy: 0.18,
  cardio_diag: 0.16,
  cardio_adherence: 0.14,
  cardio_stress: 0.08,
  cardio_sleep: 0.06,
  resp_spo2: 0.34,
  resp_rr: 0.18,
  resp_diag: 0.18,
  resp_symptom: 0.16,
  resp_sleep: 0.04,
};

export class GovernanceAwareCompositeFactory {
  create(bundle?: OrgGovernanceBundle | null): CompositeRiskEngine {
    const governance = new ResolvedGovernance(
      DEFAULT_WEIGHTS,
      bundle?.ruleWeights,
      bundle?.pathways,
    );

    return new CompositeRiskEngine(governance.weights());
  }
}