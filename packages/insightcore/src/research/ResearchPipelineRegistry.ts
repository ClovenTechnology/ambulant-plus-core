export class ResearchPipelineRegistry {
  list() {
    return [
      {
        id: 'neuro-preictal-research',
        title: 'Neuro pre-ictal research',
        family: 'autonomic-research-family',
      },
      {
        id: 'autonomic-stress-research',
        title: 'Autonomic stress research',
        family: 'autonomic-research-family',
      },
      {
        id: 'baseline-shift-research',
        title: 'Baseline shift research',
        family: 'baseline-state-interpretation-family',
      },
    ];
  }
}