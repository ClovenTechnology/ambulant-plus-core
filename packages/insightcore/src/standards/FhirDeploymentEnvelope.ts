export class FhirDeploymentEnvelope {
  build(args: {
    patientId: string;
    deploymentIssues: any[];
    observations?: any[];
  }) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      identifier: {
        value: `insightcore-deployment-${args.patientId}`,
      },
      meta: {
        tag: [{ code: 'deployment_safe' }],
      },
      entry: [
        ...(args.observations ?? []).map((resource) => ({ resource })),
        ...args.deploymentIssues.map((resource) => ({ resource })),
      ],
    };
  }
}