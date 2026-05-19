export class RuntimeStandardsRouter {
  route(args: { research: boolean }) {
    return {
      fhirTarget: args.research ? 'research_envelope' : 'deployment_envelope',
      omopTarget: args.research ? 'research_envelope' : 'deployment_envelope',
    };
  }
}