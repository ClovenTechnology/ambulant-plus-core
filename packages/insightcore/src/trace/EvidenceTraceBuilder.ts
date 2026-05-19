import type {
  Alert,
  Episode,
  FeatureVector,
  Insight,
  PatientContextWindow,
} from '../contracts';
import type { EvidenceTrace, EvidenceTraceEdge, EvidenceTraceNode } from '../contracts/trace';

export class EvidenceTraceBuilder {
  build(args: {
    patientId: string;
    context: PatientContextWindow;
    featureVector: FeatureVector;
    inferences: Array<{ model: string; syndrome?: string; timestamp: string }>;
    episodes: Episode[];
    alerts: Alert[];
    insights: Insight[];
  }): EvidenceTrace {
    const nodes: EvidenceTraceNode[] = [];
    const edges: EvidenceTraceEdge[] = [];

    for (const ev of args.featureVector.evidence) {
      const inputId = `input:${ev.code}`;
      nodes.push({
        id: inputId,
        kind: 'input',
        label: ev.label,
        source: ev.source,
        value: ev.value ?? null,
        timestamp: ev.observedAt,
      });
    }

    nodes.push({
      id: 'feature-vector',
      kind: 'feature',
      label: 'Feature Vector',
      timestamp: args.featureVector.generatedAt,
    });

    for (const ev of args.featureVector.evidence) {
      edges.push({
        from: `input:${ev.code}`,
        to: 'feature-vector',
        reason: 'contributed_to_feature_fabric',
      });
    }

    for (const inf of args.inferences) {
      const id = `inference:${inf.model}:${inf.timestamp}`;
      nodes.push({
        id,
        kind: 'inference',
        label: inf.model,
        source: inf.syndrome,
        timestamp: inf.timestamp,
      });
      edges.push({
        from: 'feature-vector',
        to: id,
        reason: 'evaluated_by_inference_engine',
      });
    }

    for (const ep of args.episodes) {
      const id = `episode:${ep.id}`;
      nodes.push({
        id,
        kind: 'episode',
        label: ep.title,
        source: ep.syndrome,
        value: ep.riskScore,
        timestamp: ep.updatedAt,
      });

      for (const inf of ep.inferences) {
        edges.push({
          from: `inference:${inf.model}:${inf.timestamp}`,
          to: id,
          reason: 'grouped_into_episode',
        });
      }
    }

    for (const alert of args.alerts) {
      const id = `alert:${alert.id}`;
      nodes.push({
        id,
        kind: 'alert',
        label: alert.type,
        source: alert.syndrome,
        value: alert.score,
        timestamp: alert.timestamp,
      });
      if (alert.episodeId) {
        edges.push({
          from: `episode:${alert.episodeId}`,
          to: id,
          reason: 'episode_emitted_alert',
        });
      }
    }

    for (const insight of args.insights) {
      const id = `insight:${insight.id}`;
      nodes.push({
        id,
        kind: 'insight',
        label: insight.title,
        source: insight.audience,
        value: insight.confidence,
        timestamp: insight.timestamp,
      });
      if (insight.episodeId) {
        edges.push({
          from: `episode:${insight.episodeId}`,
          to: id,
          reason: 'episode_generated_insight',
        });
      }
    }

    return {
      patientId: args.patientId,
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
      evidence: args.featureVector.evidence,
    };
  }
}