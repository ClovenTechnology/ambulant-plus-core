import type { ClinicalPhase, DomainContext } from '../contracts';

export interface ClinicalPhaseResolverInput {
  activeConditions?: string[];
  recentProcedureTypes?: string[];
  recentDiagnoses?: string[];
  recentSymptoms?: string[];
  recentVaccinations?: string[];
  domain?: DomainContext;
}

export class ClinicalPhaseResolver {
  resolve(input: ClinicalPhaseResolverInput): ClinicalPhase {
    const conditions = new Set((input.activeConditions ?? []).map(this.norm));
    const procedures = new Set((input.recentProcedureTypes ?? []).map(this.norm));
    const diagnoses = new Set((input.recentDiagnoses ?? []).map(this.norm));
    const symptoms = new Set((input.recentSymptoms ?? []).map(this.norm));
    const recentVaccination = (input.recentVaccinations ?? []).length > 0;

    if (input.domain?.antenatal?.gestationalWeeks) return 'pregnancy';
    if (diagnoses.has('postpartum') || symptoms.has('postpartum bleeding')) return 'post_partum';
    if (procedures.has('surgery') || procedures.has('operation') || procedures.has('caesarean section')) {
      return 'post_op';
    }
    if (diagnoses.has('trauma') || diagnoses.has('accident') || diagnoses.has('fracture')) {
      return 'post_trauma';
    }
    if (recentVaccination) return 'post_vaccination';
    if (conditions.size > 0) return 'chronic_management';
    return 'baseline';
  }

  private norm(value: string): string {
    return String(value || '').trim().toLowerCase();
  }
}