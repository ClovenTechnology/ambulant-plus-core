// apps/clinician-app/app/insightcore/services/priority-engine.ts

import { EventBus } from './event-bus';

type RiskEvent = {
  id: string;
  patientId: string;
  score: number;
  category: string;
  timestamp: number;
};

type AlertEvent = {
  id: string;
  patientId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
};

type InsightEvent = {
  id: string;
  patientId: string;
  confidence: number;
  timestamp: number;
};

type PriorityCase = {
  patientId: string;
  priorityScore: number;
  reasons: string[];
  lastUpdate: number;
};

const priorityStore = new Map<string, PriorityCase>();

const severityWeight = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 6,
};

function calculatePriority(input: {
  risk?: RiskEvent;
  alert?: AlertEvent;
  insight?: InsightEvent;
  previous?: PriorityCase;
}): PriorityCase {
  let score = 0;
  const reasons: string[] = [];

  if (input.risk) {
    score += input.risk.score * 10;
    reasons.push(`Risk score ${input.risk.score}`);
  }

  if (input.alert) {
    score += severityWeight[input.alert.severity] * 5;
    reasons.push(`Alert severity ${input.alert.severity}`);
  }

  if (input.insight) {
    score += input.insight.confidence * 8;
    reasons.push(`Insight confidence ${input.insight.confidence}`);
  }

  // decay older cases
  if (input.previous) {
    const age = Date.now() - input.previous.lastUpdate;
    if (age > 1000 * 60 * 30) { // 30 min decay
      score *= 0.85;
      reasons.push('Priority decay (stale case)');
    }
  }

  return {
    patientId:
      input.risk?.patientId ||
      input.alert?.patientId ||
      input.insight?.patientId ||
      input.previous!.patientId,
    priorityScore: Math.round(score * 100) / 100,
    reasons,
    lastUpdate: Date.now(),
  };
}
