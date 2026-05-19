export class FhirResearchEnvelope {
  build(args: {
    patientId: string;
    researchIssues: any[];
  }) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      identifier: {
        value: `insightcore-research-${args.patientId}`,
      },
      meta: {
        tag: [{ code: 'research_only' }],
      },
      entry: args.researchIssues.map((resource) => ({ resource })),
    };
  }
}