export class FamilyScorecard {
  build(args: { families: any[] }) {
    return {
      generatedAt: new Date().toISOString(),
      families: (args.families || []).map((f: any) => ({
        familyId: f.familyId ?? f.id,
        allowed: f.allowed ?? null,
        class: f.class ?? null,
      })),
    };
  }
}