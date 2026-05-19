import type { EngineLineage } from '../contracts/lineage';

export class EngineRegistry {
  list(): EngineLineage[] {
    return [
      { id: 'context-engine', version: '2.0.0', title: 'Context Engine', category: 'context' },
      { id: 'feature-fabric', version: '2.0.0', title: 'Feature Fabric', category: 'feature_fabric' },
      { id: 'rule-based-inference', version: '2.0.0', title: 'Rule-Based Inference Engine', category: 'inference' },
      { id: 'composite-risk', version: '2.0.0', title: 'Composite Risk Engine', category: 'inference' },
      { id: 'maternal-pathway', version: '2.0.0', title: 'Maternal Pathway Engine', category: 'pathway' },
      { id: 'post-procedure-recovery', version: '2.0.0', title: 'Post-Procedure Recovery Engine', category: 'pathway' },
      { id: 'medication-adherence-impact', version: '2.0.0', title: 'Medication Adherence Impact Engine', category: 'pathway' },
      { id: 'episode-engine', version: '2.0.0', title: 'Episode Engine', category: 'episodes' },
      { id: 'alert-engine-v2', version: '2.0.0', title: 'Alert Engine V2', category: 'alerts' },
      { id: 'insight-generator-v2', version: '2.0.0', title: 'Insight Generator V2', category: 'insights' },
    ];
  }
}