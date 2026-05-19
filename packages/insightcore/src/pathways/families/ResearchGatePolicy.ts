export class ResearchGatePolicy {
  allow(args: { familyId: string; researchMode?: boolean }) {
    if (args.familyId.includes('research')) {
      return Boolean(args.researchMode);
    }
    return true;
  }
}