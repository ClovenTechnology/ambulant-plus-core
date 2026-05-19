import { ResearchPipelineRegistry } from './ResearchPipelineRegistry';

export class ResearchPipelinePlanner {
  private registry = new ResearchPipelineRegistry();

  build() {
    return {
      generatedAt: new Date().toISOString(),
      pipelines: this.registry.list(),
    };
  }
}