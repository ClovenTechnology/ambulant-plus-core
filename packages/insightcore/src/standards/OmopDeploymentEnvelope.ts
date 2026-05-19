export class OmopDeploymentEnvelope {
  build(args: {
    patientId: string;
    baseline: any;
    episodes: any[];
  }) {
    return {
      generatedAt: new Date().toISOString(),
      patient_id: args.patientId,
      envelope_class: 'deployment',
      baseline: args.baseline,
      episodes: args.episodes,
    };
  }
}