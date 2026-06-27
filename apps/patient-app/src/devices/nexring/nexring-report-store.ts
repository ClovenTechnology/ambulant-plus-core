'use client';

import type {
  RingDailySummary,
  RingHydrationState,
  RingMetric,
  RingReportSnapshot,
} from './nexring-types';
import type { NexRingPacket } from './nexring-protocol';
import { type SleepSession, upsertSleepSession } from './nexring-view-model';

function initialHydrationState(): RingHydrationState {
  return {
    phase: 'idle',
    receivedPackets: 0,
    receivedMetrics: 0,
    familyCounts: {},
    algorithmPackets: 0,
    activePackets: 0,
    sleepPackets: 0,
    historyErrorPackets: 0,
  };
}

function nextFamilyCount(
  counts: Partial<Record<string, number>>,
  family: string,
): Partial<Record<string, number>> {
  return {
    ...counts,
    [family]: (counts[family] ?? 0) + 1,
  };
}

function mergeDailySummary(
  prev: RingDailySummary | null,
  next: Partial<RingDailySummary>,
): RingDailySummary {
  const ts = next.ts ?? prev?.ts ?? Date.now();
  return {
    ts,
    steps: next.steps ?? prev?.steps,
    calories: next.calories ?? prev?.calories,
    distanceMeters: next.distanceMeters ?? prev?.distanceMeters,
    walkingSteps: next.walkingSteps ?? prev?.walkingSteps,
    runningSteps: next.runningSteps ?? prev?.runningSteps,
    otherSteps: next.otherSteps ?? prev?.otherSteps,
    walkingDistanceMeters:
      next.walkingDistanceMeters ?? prev?.walkingDistanceMeters,
    runningDistanceMeters:
      next.runningDistanceMeters ?? prev?.runningDistanceMeters,
    otherDistanceMeters:
      next.otherDistanceMeters ?? prev?.otherDistanceMeters,
  };
}

function isTrustedNightSpo2(value: number, sourceMode?: string) {
  if (!Number.isFinite(value)) return false;
  if (value < 80 || value > 100) return false;
  return sourceMode !== 'live';
}

export class NexRingReportStore {
  private hydration: RingHydrationState = initialHydrationState();
  private sleepSessions: SleepSession[] = [];
  private dailySummary: RingDailySummary | null = null;
  private derived: RingReportSnapshot['derived'] = {};

  reset() {
    this.hydration = initialHydrationState();
    this.sleepSessions = [];
    this.dailySummary = null;
    this.derived = {};
  }

  markRequestedCount() {
    this.hydration = {
      ...this.hydration,
      phase: 'requested_count',
      requestedAt: Date.now(),
    };
  }

  markRequestedData() {
    this.hydration = {
      ...this.hydration,
      phase: 'requested_data',
      requestedAt: Date.now(),
    };
  }

  ingestPacket(packet: NexRingPacket, countEstimate?: number) {
    const family = packet.family || 'unknown';

    this.hydration = {
      ...this.hydration,
      phase: 'receiving',
      receivedPackets: this.hydration.receivedPackets + 1,
      lastPacketCmd: packet.cmd ?? undefined,
      lastPacketTs: Date.now(),
      countEstimate:
        typeof countEstimate === 'number'
          ? Math.max(countEstimate, this.hydration.countEstimate ?? 0)
          : this.hydration.countEstimate,
      familyCounts: nextFamilyCount(this.hydration.familyCounts, family),
      algorithmPackets:
        this.hydration.algorithmPackets +
        (family === 'algorithm_history' ? 1 : 0),
      activePackets:
        this.hydration.activePackets +
        (family === 'active_data' || family === 'active_data_2' ? 1 : 0),
      sleepPackets:
        this.hydration.sleepPackets + (family === 'sleep_history' ? 1 : 0),
      historyErrorPackets:
        this.hydration.historyErrorPackets +
        (family === 'history_error' ? 1 : 0),
    };

    this.maybeComplete();
  }

  ingestMetrics(metrics: RingMetric[], source: 'live' | 'history') {
    if (metrics.length === 0) return;

    this.hydration = {
      ...this.hydration,
      phase: source === 'history' ? 'receiving' : this.hydration.phase,
      receivedMetrics:
        source === 'history'
          ? this.hydration.receivedMetrics + metrics.length
          : this.hydration.receivedMetrics,
      lastPacketTs: Date.now(),
    };

    for (const metric of metrics) {
      if (metric.kind === 'sleep') {
        this.sleepSessions = upsertSleepSession(this.sleepSessions, metric);
      }

      if (metric.kind === 'health') {
        if (typeof metric.rhr === 'number') {
          this.derived = { ...this.derived, rhr: metric.rhr };
        }

        if (typeof metric.sleepAvgHr === 'number') {
          this.derived = { ...this.derived, sleepAvgHr: metric.sleepAvgHr };
        }

        if (typeof metric.rr === 'number' && metric.sourceMode !== 'live') {
          this.derived = { ...this.derived, rr: metric.rr };
        }

        if (
          typeof metric.nightSpo2 === 'number' &&
          isTrustedNightSpo2(metric.nightSpo2, metric.sourceMode)
        ) {
          this.derived = { ...this.derived, nightSpo2: metric.nightSpo2 };
        } else if (
          typeof metric.spo2 === 'number' &&
          isTrustedNightSpo2(metric.spo2, metric.sourceMode)
        ) {
          this.derived = { ...this.derived, nightSpo2: metric.spo2 };
        }
      }

      if (metric.kind === 'activity') {
        this.dailySummary = mergeDailySummary(this.dailySummary, {
          ts: metric.ts,
          steps: metric.steps,
          calories: metric.calories,
          distanceMeters: metric.distanceMeters,
        });
      }

      if (metric.kind === 'health' && typeof metric.hr === 'number') {
        this.dailySummary = mergeDailySummary(this.dailySummary, {
          ts: metric.ts,
        });
      }
    }

    this.maybeComplete();
  }

  ingestDailySummary(summary: Partial<RingDailySummary>) {
    this.dailySummary = mergeDailySummary(this.dailySummary, summary);
  }

  getSnapshot(): RingReportSnapshot {
    return {
      hydration: this.hydration,
      sleepSessions: this.sleepSessions,
      dailySummary: this.dailySummary,
      derived: this.derived,
    };
  }

  private maybeComplete() {
    const estimate = this.hydration.countEstimate;
    if (
      typeof estimate === 'number' &&
      estimate > 10 &&
      (
        this.hydration.receivedMetrics >= estimate ||
        this.hydration.receivedPackets >= estimate
      )
    ) {
      this.hydration = {
        ...this.hydration,
        phase: 'complete',
      };
    }
  }
}