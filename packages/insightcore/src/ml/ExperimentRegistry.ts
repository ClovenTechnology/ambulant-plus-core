export interface RegisteredExperiment {
  id: string;
  title: string;
  version: string;
  active: boolean;
  family: 'weights' | 'pathway' | 'ml';
  owner: string;
}

export class ExperimentRegistry {
  list(): RegisteredExperiment[] {
    return [
      {
        id: 'default-governance-v1',
        title: 'Default governance baseline',
        version: '1.0.0',
        active: true,
        family: 'weights',
        owner: 'insightcore',
      },
    ];
  }
}