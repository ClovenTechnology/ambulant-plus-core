import { FhirObservationMapper } from './FhirObservationMapper';
import type { FeatureVector } from '../contracts';

export class FhirBundleProjector {
  map(featureVector: FeatureVector) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: new FhirObservationMapper().map(featureVector).map((resource) => ({
        resource,
      })),
    };
  }
}