import type { PatientContextWindow } from '../contracts';

export class PhaseAwareContextAugmenter {
  augment(context: PatientContextWindow) {
    return {
      ...context,
      domain: {
        ...context.domain,
        systemPhaseFlags: {
          postPartum: context.clinicalPhase === 'post_partum',
          pregnancy: context.clinicalPhase === 'pregnancy',
          postOp: context.clinicalPhase === 'post_op',
          postVaccination: context.clinicalPhase === 'post_vaccination',
          chronicManagement: context.clinicalPhase === 'chronic_management',
        },
      },
    };
  }
}