export class ResearchIsolationPolicy {
  classifyInference(model: string, ruleId?: string) {
    const isResearch =
      model.includes('research') ||
      String(ruleId || '').startsWith('research.');

    return {
      class: isResearch ? 'research' : 'deployment',
      deployable: !isResearch,
    };
  }
}