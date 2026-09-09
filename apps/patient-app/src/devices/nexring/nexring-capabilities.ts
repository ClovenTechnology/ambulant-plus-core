import type { RingDeviceInfo, RingScanDevice } from './nexring-types';

export type NexRingModelFamily = 'sr09' | 'sr23' | 'sr28' | 'unknown';
export type Sr09SportMode = 0 | 1;

export type NexRingCapabilities = {
  model: NexRingModelFamily;
  legacyHistory: boolean;
  legacySleep: boolean;
  steps: boolean;
  legacySport: boolean;
  runSport: boolean;
  otherSport: boolean;
  pauseContinue: boolean;
  advancedExercise: boolean;
  mindfulness: boolean;
  sportRecordingIntervalSec?: { min: number; max: number };
  sportDurationMinutes?: { min: number; max: number };
};

export const SR09_SPORT_LIMITS = Object.freeze({
  minRecordingIntervalSec: 10,
  maxRecordingIntervalSec: 180,
  minDurationMinutes: 5,
  maxDurationMinutes: 180,
});

function hintText(device?: RingScanDevice | null, info?: RingDeviceInfo | null) {
  return [device?.name, device?.id, device?.mac, info?.model, info?.hardware, info?.software]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

export function detectNexRingModel(
  device?: RingScanDevice | null,
  info?: RingDeviceInfo | null,
): NexRingModelFamily {
  const hint = hintText(device, info);
  if (/\bSR09(?:_|\b)/i.test(hint)) return 'sr09';
  if (/\bSR23(?:_|\b)/i.test(hint)) return 'sr23';
  if (/\bSR28(?:_|\b)/i.test(hint)) return 'sr28';
  return 'unknown';
}

export function capabilitiesForModel(model: NexRingModelFamily): NexRingCapabilities {
  if (model === 'sr09' || model === 'sr23') {
    return {
      model,
      legacyHistory: true,
      legacySleep: true,
      steps: true,
      legacySport: true,
      runSport: true,
      otherSport: true,
      pauseContinue: false,
      advancedExercise: false,
      mindfulness: false,
      sportRecordingIntervalSec: { min: 10, max: 180 },
      sportDurationMinutes: { min: 5, max: 180 },
    };
  }

  if (model === 'sr28') {
    return {
      model,
      legacyHistory: false,
      legacySleep: false,
      steps: true,
      legacySport: false,
      runSport: true,
      otherSport: true,
      pauseContinue: true,
      advancedExercise: true,
      mindfulness: true,
    };
  }

  return {
    model: 'unknown',
    legacyHistory: true,
    legacySleep: true,
    steps: true,
    legacySport: false,
    runSport: false,
    otherSport: false,
    pauseContinue: false,
    advancedExercise: false,
    mindfulness: false,
  };
}

export function detectNexRingCapabilities(
  device?: RingScanDevice | null,
  info?: RingDeviceInfo | null,
) {
  return capabilitiesForModel(detectNexRingModel(device, info));
}

export type Sr09SportParameters = {
  switch: 0 | 1;
  timeInterval: number;
  duration: number;
  mode: Sr09SportMode;
};

export function buildSr09SportParameters(input: {
  switch: 0 | 1;
  mode?: Sr09SportMode;
  timeInterval?: number;
  duration?: number;
}): Sr09SportParameters {
  if (input.switch === 0) {
    // The vendor SDK ignores remaining sport fields when switch=0 and generates
    // fe 20 00 00 ... 00 de. Keep them zero to mirror the documented STOP.
    return { switch: 0, timeInterval: 0, duration: 0, mode: 0 };
  }

  const mode = input.mode ?? 1;
  const timeInterval = Number(input.timeInterval);
  const duration = Number(input.duration);

  if (mode !== 0 && mode !== 1) {
    throw new Error('SR09 sport mode must be 0 (Other sport) or 1 (Run)');
  }
  if (!Number.isInteger(timeInterval) || timeInterval < 10 || timeInterval > 180) {
    throw new Error('SR09 recording interval must be an integer from 10 to 180 seconds');
  }
  if (!Number.isInteger(duration) || duration < 5 || duration > 180) {
    throw new Error('SR09 sport duration must be an integer from 5 to 180 minutes');
  }

  return { switch: 1, timeInterval, duration, mode };
}
