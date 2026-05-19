export class FhirOperationalEnvelope {
  build(args: {
    observationBundle: any;
    episodeBundle: any;
    patientId: string;
  }) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      identifier: {
        value: `insightcore-operational-${args.patientId}`,
      },
      entry: [
        ...(args.observationBundle?.entry || []),
        ...(args.episodeBundle?.entry || []),
      ],
    };
  }
}