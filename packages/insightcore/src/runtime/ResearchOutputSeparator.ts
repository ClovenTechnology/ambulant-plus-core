import type { InferenceOutput } from '../contracts';

export class ResearchOutputSeparator {
  split(inferences: InferenceOutput[]) {
    const research = inferences.filter(
      (inf) =>
        String(inf.model).includes('research') ||
        String(inf.output?.ruleId || '').startsWith('research.'),
    );

    const deployment = inferences.filter(
      (inf) =>
        !String(inf.model).includes('research') &&
        !String(inf.output?.ruleId || '').startsWith('research.'),
    );

    return {
      research,
      deployment,
    };
  }
}