'use client';

import type { RingMetric } from './nexring-types';
import type { NexRingPacket } from './nexring-protocol';

export type NexRingLiveStreamKind =
  | 'health'
  | 'single_health'
  | 'oxygen'
  | 'mindfulness'
  | 'temperature_like'
  | 'exercise'
  | 'unknown';

export type NexRingHealthEnvelope = {
  ts: number;
  cmd: number;
  streamKind: NexRingLiveStreamKind;
  opticalHint: string | null;
  sampleValidity: 'good' | 'partial' | 'empty';
  hrCandidates: number[];
  spo2Candidates: number[];
  tempCandidates: number[];
  preferredHr?: number;
  preferredSpo2?: number;
  preferredTempDeviation?: number;
  byteMap: {
    byte2?: number;
    byte3?: number;
    byte4?: number;
    byte5?: number;
    byte6?: number;
    byte7?: number;
    byte8?: number;
    byte9?: number;
  };
};

function signed8(v: number): number {
  return v > 127 ? v - 256 : v;
}

function nearestTo(values: number[], target: number) {
  return values.reduce((best, current) =>
    Math.abs(current - target) < Math.abs(best - target) ? current : best,
  );
}

function unique(nums: number[]) {
  return Array.from(new Set(nums));
}

function pickHr(candidates: number[], prevHr?: number) {
  const plausible = candidates.filter((v) => v >= 35 && v <= 220);
  if (plausible.length === 0) return undefined;
  if (typeof prevHr === 'number' && Number.isFinite(prevHr)) {
    return nearestTo(plausible, prevHr);
  }
  const preferred = plausible.filter((v) => v >= 45 && v <= 140);
  if (preferred.length > 0) return nearestTo(preferred, 72);
  return nearestTo(plausible, 72);
}

function pickSpo2(candidates: number[], hr?: number) {
  const plausible = candidates.filter((v) => v >= 70 && v <= 100);
  if (plausible.length === 0) return undefined;
  const filtered =
    typeof hr === 'number'
      ? plausible.filter((v) => Math.abs(v - hr) > 3)
      : plausible;
  if (filtered.length === 0) return undefined;
  return nearestTo(filtered, 97);
}

function pickTempDeviation(candidates: number[]) {
  const normalized = candidates
    .map((v) => signed8(v) / 10)
    .filter((v) => v >= -3 && v <= 3);

  if (normalized.length === 0) return undefined;
  return normalized[0];
}

function inferStreamKind(packet: NexRingPacket): NexRingLiveStreamKind {
  const mode = packet.meta.measurementMode;
  if (mode === 'single_health') return 'single_health';
  if (mode === 'oxygen') return 'oxygen';
  if (mode === 'mindfulness') return 'mindfulness';
  if (mode === 'temperature') return 'temperature_like';
  if (mode === 'exercise') return 'exercise';
  if (mode === 'health') return 'health';
  return 'unknown';
}

export function isLiveHealthPacket(packet: NexRingPacket) {
  return packet.header === 0xfe && packet.cmd === 0x83;
}

export function decodeLiveHealthPacket(
  packet: NexRingPacket,
  options?: { prevHr?: number },
): NexRingHealthEnvelope | null {
  if (!isLiveHealthPacket(packet)) return null;

  const raw = packet.raw;

  const byteMap = {
    byte2: raw[2],
    byte3: raw[3],
    byte4: raw[4],
    byte5: raw[5],
    byte6: raw[6],
    byte7: raw[7],
    byte8: raw[8],
    byte9: raw[9],
  };

  const hrCandidates = unique(
    [raw[2], raw[3], raw[4], raw[5], raw[6], raw[8], raw[9]].filter(
      (v) => typeof v === 'number' && Number.isFinite(v),
    ) as number[],
  );

  const spo2Candidates = unique(
    [raw[2], raw[3], raw[4], raw[5], raw[6], raw[8], raw[9]].filter(
      (v) => typeof v === 'number' && Number.isFinite(v),
    ) as number[],
  );

  const tempCandidates = unique(
    [raw[4], raw[5], raw[6], raw[8], raw[9]].filter(
      (v) => typeof v === 'number' && Number.isFinite(v),
    ) as number[],
  );

  const preferredHr = pickHr(hrCandidates, options?.prevHr);
  const preferredSpo2 = pickSpo2(spo2Candidates, preferredHr);
  const preferredTempDeviation = pickTempDeviation(tempCandidates);

  const nonZero =
    [raw[2], raw[3], raw[4], raw[5], raw[6], raw[7], raw[8], raw[9]].filter(
      (v) => typeof v === 'number' && v !== 0,
    ).length || 0;

  const sampleValidity =
    nonZero >= 3 ? 'good' : nonZero >= 1 ? 'partial' : 'empty';

  return {
    ts: Date.now(),
    cmd: 0x83,
    streamKind: inferStreamKind(packet),
    opticalHint:
      typeof packet.meta.opticalHint === 'string' ? packet.meta.opticalHint : null,
    sampleValidity,
    hrCandidates,
    spo2Candidates,
    tempCandidates,
    preferredHr,
    preferredSpo2,
    preferredTempDeviation,
    byteMap,
  };
}

export function metricFromLiveHealthEnvelope(
  env: NexRingHealthEnvelope,
): RingMetric | null {
  if (
    typeof env.preferredHr !== 'number' &&
    typeof env.preferredSpo2 !== 'number' &&
    typeof env.preferredTempDeviation !== 'number'
  ) {
    return null;
  }

  return {
    kind: 'health',
    ts: env.ts,
    hr: env.preferredHr,
    spo2:
      env.streamKind === 'oxygen' || env.streamKind === 'mindfulness'
        ? env.preferredSpo2
        : undefined,
  };
}