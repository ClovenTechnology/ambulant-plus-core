export interface RegisteredModel {
  id: string;
  version: string;
  title: string;
  family: 'rule' | 'composite' | 'pathway' | 'ml';
  active: boolean;
  owner: string;
}

export class ModelRegistry {
  list(): RegisteredModel[] {
    return [
      {
        id: 'rule-based-inference',
        version: '2.0.0',
        title: 'Rule-Based Inference Engine',
        family: 'rule',
        active: true,
        owner: 'insightcore',
      },
      {
        id: 'composite-risk',
        version: '2.0.0',
        title: 'Composite Risk Engine',
        family: 'composite',
        active: true,
        owner: 'insightcore',
      },
      {
        id: 'maternal-pathway',
        version: '2.0.0',
        title: 'Maternal Pathway Engine',
        family: 'pathway',
        active: true,
        owner: 'insightcore',
      },
      {
        id: 'post-procedure-recovery',
        version: '2.0.0',
        title: 'Post-Procedure Recovery Engine',
        family: 'pathway',
        active: true,
        owner: 'insightcore',
      },
      {
        id: 'medication-adherence-impact',
        version: '2.0.0',
        title: 'Medication Adherence Impact Engine',
        family: 'pathway',
        active: true,
        owner: 'insightcore',
      },
    ];
  }
}