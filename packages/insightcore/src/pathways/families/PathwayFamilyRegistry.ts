import type { PathwayFamily } from '../../contracts/pathway-family';

export class PathwayFamilyRegistry {
  list(): PathwayFamily[] {
    return [
      {
        id: 'cardio-family',
        version: '1.0.0',
        title: 'Cardiovascular family',
        description: 'Deployment-oriented cardiovascular risk pathways',
        members: [
          { id: 'composite-cardio-context', version: '2.0.0', title: 'Composite cardio context', kind: 'deployment' },
          { id: 'sleep-debt-bp-trajectory', version: '1.0.0', title: 'Sleep debt BP trajectory', kind: 'deployment' },
          { id: 'sleep-debt-escalation-forecaster', version: '1.0.0', title: 'Sleep debt escalation forecaster', kind: 'deployment' },
        ],
      },
      {
        id: 'baseline-state-interpretation-family',
        version: '1.0.0',
        title: 'Baseline state interpretation family',
        description: 'Baseline deviation interpretation and state attribution',
        members: [
          { id: 'baseline-deviation-engine', version: '1.0.0', title: 'Baseline deviation engine', kind: 'deployment' },
          { id: 'baseline-state-interpreter', version: '1.0.0', title: 'Baseline state interpreter', kind: 'deployment' },
        ],
      },
      {
        id: 'autonomic-research-family',
        version: '1.0.0',
        title: 'Autonomic research family',
        description: 'Research-gated neuro/autonomic pathways',
        members: [
          { id: 'seizure-research-engine', version: '1.0.0', title: 'Seizure research engine', kind: 'research' },
          { id: 'autonomic-shift-research-engine', version: '1.0.0', title: 'Autonomic shift research engine', kind: 'research' },
          { id: 'autonomic-stress-research-engine', version: '1.0.0', title: 'Autonomic stress research engine', kind: 'research' },
        ],
      },
      {
        id: 'recovery-family',
        version: '1.0.0',
        title: 'Recovery family',
        description: 'Recovery-state stabilization and non-deterioration interpretation',
        members: [
          { id: 'sleep-debt-recovery-engine', version: '1.0.0', title: 'Sleep debt recovery engine', kind: 'deployment' },
          { id: 'recovery-stability-engine', version: '1.0.0', title: 'Recovery stability engine', kind: 'deployment' },
        ],
      },
    ];
  }
}