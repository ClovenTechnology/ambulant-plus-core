export class FamilyRolloutPolicy {
  allow(args: {
    familyId: string;
    researchMode?: boolean;
  }) {
    if (args.familyId === 'neuro-research-family') {
      return Boolean(args.researchMode);
    }
    return true;
  }
}