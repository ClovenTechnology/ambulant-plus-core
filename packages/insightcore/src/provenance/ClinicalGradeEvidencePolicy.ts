import type { ProvenancedEvidence } from '../contracts/provenance';

export class ClinicalGradeEvidencePolicy {
  partition(evidence: ProvenancedEvidence[]) {
    return {
      clinicalGrade: evidence.filter((e) => (e.provenance.sourcePriority ?? 0) >= 90),
      consumerGrade: evidence.filter((e) => (e.provenance.sourcePriority ?? 0) < 90),
    };
  }
}