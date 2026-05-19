'use client';

import type {
  RingHydrationState,
  RingMetric,
} from './nexring-types';
import type { NexRingPacket } from './nexring-protocol';

export type NexRingHistoryPhase =
  | 'idle'
  | 'requested_count'
  | 'requested_data'
  | 'receiving'
  | 'complete';

export type NexRingHistoryState = RingHydrationState;

export type NexRingSleepSessionDraft = {
  id: string;
  endTs: number;
  score?: number;
  remMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
};

function isHistoryCmd(cmd: number | null) {
  return (
    cmd === 0x81 ||
    cmd === 0x82 ||
    cmd === 0x91 ||
    cmd === 0x92 ||
    cmd === 0xc1 ||
    cmd === 0xc2 ||
    cmd === 0xc8 ||
    cmd === 0xc9 ||
    cmd === 0xca ||
    cmd === 0xcb ||
    cmd === 0xce ||
    cmd === 0xd1 ||
    cmd === 0xd3 ||
    cmd === 0xd4 ||
    cmd === 0xd5
  );
}

function maybeCountFromPacket(packet: NexRingPacket) {
  const raw = packet.raw;
  if (packet.cmd !== 0x81 || raw.length < 4) return undefined;

  const count8 = raw[2];
  const count16 = (raw[2] ?? 0) | ((raw[3] ?? 0) << 8);

  if (count16 > 3 && count16 < 50000) return count16;
  if (count8 > 3 && count8 < 255) return count8;
  return undefined;
}

function initialState(): NexRingHistoryState {
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

export class NexRingHistoryTracker {
  private state: NexRingHistoryState = initialState();
  private sleepDrafts = new Map<string, NexRingSleepSessionDraft>();

  getState() {
    return this.state;
  }

  reset() {
    this.state = initialState();
    this.sleepDrafts.clear();
  }

  markRequestedCount() {
    this.state = {
      ...this.state,
      phase: 'requested_count',
      requestedAt: Date.now(),
    };
  }

  markRequestedData() {
    this.state = {
      ...this.state,
      phase: 'requested_data',
      requestedAt: Date.now(),
    };
  }

  ingestPacket(packet: NexRingPacket) {
    if (!isHistoryCmd(packet.cmd)) return null;

    const countEstimate = maybeCountFromPacket(packet);
    const family = packet.family || 'unknown';

    this.state = {
      ...this.state,
      phase: 'receiving',
      receivedPackets: this.state.receivedPackets + 1,
      lastPacketCmd: packet.cmd ?? undefined,
      lastPacketTs: Date.now(),
      countEstimate:
        typeof countEstimate === 'number'
          ? Math.max(countEstimate, this.state.countEstimate ?? 0)
          : this.state.countEstimate,
      familyCounts: {
        ...this.state.familyCounts,
        [family]: (this.state.familyCounts[family] ?? 0) + 1,
      },
      algorithmPackets:
        this.state.algorithmPackets +
        (family === 'algorithm_history' ? 1 : 0),
      activePackets:
        this.state.activePackets +
        (family === 'active_data' || family === 'active_data_2' ? 1 : 0),
      sleepPackets:
        this.state.sleepPackets + (family === 'sleep_history' ? 1 : 0),
      historyErrorPackets:
        this.state.historyErrorPackets + (family === 'history_error' ? 1 : 0),
    };

    this.maybeComplete();

    return {
      phase: this.state.phase,
      countEstimate: this.state.countEstimate,
      receivedPackets: this.state.receivedPackets,
      lastPacketCmd: this.state.lastPacketCmd,
      familyCounts: this.state.familyCounts,
    };
  }

  ingestHistoricalMetric(metric: RingMetric) {
    this.state = {
      ...this.state,
      phase: 'receiving',
      receivedMetrics: this.state.receivedMetrics + 1,
      lastPacketTs: metric.ts || Date.now(),
    };

    if (metric.kind === 'sleep') {
      const id = String(metric.ts || Date.now());
      this.sleepDrafts.set(id, {
        id,
        endTs: metric.ts || Date.now(),
        score: metric.score,
        remMinutes: metric.remMinutes,
        deepMinutes: metric.deepMinutes,
        lightMinutes: metric.lightMinutes,
        awakeMinutes: metric.awakeMinutes,
      });
    }

    this.maybeComplete();
  }

  markComplete() {
    this.state = {
      ...this.state,
      phase: 'complete',
    };
  }

  getSleepDrafts() {
    return Array.from(this.sleepDrafts.values()).sort((a, b) => a.endTs - b.endTs);
  }

  private maybeComplete() {
    const estimate = this.state.countEstimate;
    if (
      typeof estimate === 'number' &&
      estimate >= 50 &&
      (
        this.state.receivedMetrics >= estimate ||
        this.state.receivedPackets >= estimate
      )
    ) {
      this.state = {
        ...this.state,
        phase: 'complete',
      };
    }
  }
}

export function isHistoryPacket(packet: NexRingPacket) {
  return isHistoryCmd(packet.cmd);
}