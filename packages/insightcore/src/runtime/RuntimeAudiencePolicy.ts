export class RuntimeAudiencePolicy {
  audienceFor(args: { research: boolean }) {
    return args.research ? ['clinician', 'admin'] : ['patient', 'clinician', 'admin'];
  }
}