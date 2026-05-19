export class OmopResearchEnvelope {
  build(args: {
    patientId: string;
    experiments?: string[];
    researchSignals: any[];
  }) {
    return {
      generatedAt: new Date().toISOString(),
      patient_id: args.patientId,
      envelope_class: 'research',
      experiments: args.experiments ?? [],
      research_signals: args.researchSignals,
    };
  }
}