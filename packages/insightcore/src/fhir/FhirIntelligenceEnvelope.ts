export class FhirIntelligenceEnvelope {
  build(args: {
    observations: any[];
    issues: any[];
  }) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        ...args.observations.map((resource) => ({ resource })),
        ...args.issues.map((resource) => ({ resource })),
      ],
    };
  }
}