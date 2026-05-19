import type { ClinicalUncertainty, InferenceUncertainty, MeasurementUncertainty, UncertaintyBundle } from '../contracts/uncertainty';

export class UncertaintyComposer {
  compose(args: {
    measurement: MeasurementUncertainty;
    inference: InferenceUncertainty;
    clinical: ClinicalUncertainty;
  }): UncertaintyBundle {
    const overall =
      (args.measurement.score + args.inference.score + args.clinical.score) / 3;

    return {
      measurement: args.measurement,
      inference: args.inference,
      clinical: args.clinical,
      overall: Number(overall.toFixed(3)),
    };
  }
}