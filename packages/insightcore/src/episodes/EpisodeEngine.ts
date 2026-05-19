import { Episode, EvidenceItem, InferenceOutput, RiskLevel } from '../contracts';

export interface EpisodeEngineInput {
  patientId: string;
  existingEpisodes?: Episode[];
  inferences: InferenceOutput[];
  now?: string;
}

export class EpisodeEngine {
  group(input: EpisodeEngineInput): Episode[] {
    const now = input.now ?? new Date().toISOString();
    const existing = input.existingEpisodes ?? [];
    const nextEpisodes = [...existing];

    for (const inference of input.inferences) {
      const syndrome = inference.syndrome ?? this.inferSyndrome(inference.model);
      const suppressionKey = `${input.patientId}:${syndrome}`;

      const match = nextEpisodes.find(
        (ep) => ep.patientId === input.patientId && ep.suppressionKey === suppressionKey && ep.status !== 'resolved',
      );

      const riskScore = inference.confidence;
      const severity = this.classifySeverity(riskScore);

      if (match) {
        match.updatedAt = now;
        match.inferences.push(inference);
        match.evidence = this.mergeEvidence(match.evidence, inference.evidence);
        match.peakRiskScore = Math.max(match.peakRiskScore, riskScore);
        match.riskScore = riskScore;
        match.severity = this.maxSeverity(match.severity, severity);
        match.rationale = this.unique([
          ...match.rationale,
          ...(inference.rationale ?? []),
          `Syndrome ${syndrome} remains active`,
        ]);
        match.status = severity === 'low' ? 'watching' : 'open';
      } else {
        nextEpisodes.push({
          id: this.makeId(input.patientId, syndrome, now),
          patientId: input.patientId,
          syndrome,
          title: this.titleForSyndrome(syndrome),
          status: severity === 'low' ? 'watching' : 'open',
          severity,
          startedAt: now,
          updatedAt: now,
          riskScore,
          peakRiskScore: riskScore,
          inferences: [inference],
          evidence: [...inference.evidence],
          rationale: this.unique([
            ...(inference.rationale ?? []),
            `New ${syndrome} episode opened`,
          ]),
          suppressionKey,
        });
      }
    }

    return nextEpisodes;
  }

  private inferSyndrome(model: string): string {
    const m = model.toLowerCase();
    if (m.includes('resp')) return 'respiratory';
    if (m.includes('card')) return 'cardiac';
    if (m.includes('sepsis')) return 'systemicSepsis';
    return 'generic';
  }

  private titleForSyndrome(syndrome: string): string {
    switch (syndrome) {
      case 'cardiac':
        return 'Cardiac stress episode';
      case 'respiratory':
        return 'Respiratory compromise episode';
      case 'systemicSepsis':
        return 'Systemic instability episode';
      default:
        return 'Clinical risk episode';
    }
  }

  private classifySeverity(score: number): RiskLevel {
    if (score >= 0.9) return 'critical';
    if (score >= 0.8) return 'high';
    if (score >= 0.65) return 'moderate';
    return 'low';
  }

  private maxSeverity(a: RiskLevel, b: RiskLevel): RiskLevel {
    const order: RiskLevel[] = ['low', 'moderate', 'high', 'critical'];
    return order[Math.max(order.indexOf(a), order.indexOf(b))];
  }

  private mergeEvidence(a: EvidenceItem[], b: EvidenceItem[]): EvidenceItem[] {
    const map = new Map<string, EvidenceItem>();
    for (const item of [...a, ...b]) {
      map.set(`${item.code}:${item.source}:${item.label}`, item);
    }
    return [...map.values()];
  }

  private unique(items: string[]): string[] {
    return [...new Set(items.filter(Boolean))];
  }

  private makeId(patientId: string, syndrome: string, now: string): string {
    return `ep_${patientId}_${syndrome}_${Date.parse(now)}`;
  }
}