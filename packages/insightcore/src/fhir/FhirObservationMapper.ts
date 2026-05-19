import type { FeatureVector } from '../contracts';

export class FhirObservationMapper {
  map(featureVector: FeatureVector) {
    return featureVector.evidence.map((e) => ({
      resourceType: 'Observation',
      status: 'final',
      code: {
        text: e.label,
      },
      valueString:
        e.value === undefined || e.value === null
          ? undefined
          : String(e.value),
      effectiveDateTime: e.observedAt,
    }));
  }
}