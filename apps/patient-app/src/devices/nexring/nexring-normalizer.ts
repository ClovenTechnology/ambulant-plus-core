/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  RingActivityMetric,
  RingBatteryMetric,
  RingCommandResult,
  RingDailySummary,
  RingDeviceInfo,
  RingHealthMetric,
  RingMetric,
  RingSleepMetric,
  RingTemperatureMetric,
} from './nexring-types';

function num(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function tsFrom(input: any): number {
  const maybe =
    num(input?.ts) ??
    num(input?.time) ??
    num(input?.timestamp) ??
    num(input?.dateTime) ??
    num(input?.utc) ??
    num(input?.createTime) ??
    num(input?.timeStamp);

  if (!maybe) return Date.now();
  if (maybe < 10_000_000_000) return maybe * 1000;
  return maybe;
}

function normalizeEpochMs(value: any): number | undefined {
  const n = num(value);
  if (typeof n !== 'number') return undefined;
  return n < 10_000_000_000 ? n * 1000 : n;
}

function durationMinutesFromStage(stage: any): number {
  const directMinutes =
    num(stage?.minutes) ??
    num(stage?.durationMinutes) ??
    num(stage?.duration) ??
    num(stage?.totalMinutes);

  if (typeof directMinutes === 'number') {
    return directMinutes;
  }

  const start = normalizeEpochMs(stage?.startTime ?? stage?.startTs ?? stage?.beginTime);
  const end = normalizeEpochMs(stage?.endTime ?? stage?.endTs ?? stage?.finishTime);

  if (typeof start === 'number' && typeof end === 'number' && end >= start) {
    return Math.round((end - start) / 60000);
  }

  return 0;
}

function flattenSleepStages(raw: any) {
  const stagingList = Array.isArray(raw?.stagingList)
    ? raw.stagingList
    : Array.isArray(raw?.stages)
      ? raw.stages
      : Array.isArray(raw?.sleepStageList)
        ? raw.sleepStageList
        : [];

  let lightMinutes = 0;
  let deepMinutes = 0;
  let remMinutes = 0;
  let awakeMinutes = 0;
  let napMinutes = 0;

  for (const stage of stagingList) {
    const stageType = String(
      stage?.stagingType ??
        stage?.stageType ??
        stage?.type ??
        stage?.sleepStage ??
        '',
    ).toUpperCase();

    const minutes = durationMinutesFromStage(stage);
    if (!minutes) continue;

    switch (stageType) {
      case 'NREM1':
      case 'LIGHT':
      case 'LIGHT_SLEEP':
        lightMinutes += minutes;
        break;
      case 'NREM3':
      case 'DEEP':
      case 'DEEP_SLEEP':
        deepMinutes += minutes;
        break;
      case 'REM':
        remMinutes += minutes;
        break;
      case 'WAKE':
      case 'AWAKE':
        awakeMinutes += minutes;
        break;
      case 'NAP':
        napMinutes += minutes;
        break;
      default:
        break;
    }
  }

  return {
    lightMinutes,
    deepMinutes,
    remMinutes,
    awakeMinutes,
    napMinutes,
  };
}

function hasHealth(metric: RingHealthMetric) {
  return [
    metric.hr,
    metric.spo2,
    metric.hrv,
    metric.rr,
    metric.stress,
    metric.readiness,
    metric.rhr,
    metric.sleepAvgHr,
    metric.nightSpo2,
  ].some((v) => typeof v === 'number');
}

function hasBattery(metric: RingBatteryMetric) {
  return typeof metric.pct === 'number' || typeof metric.charging === 'boolean';
}

function hasTemperature(metric: RingTemperatureMetric) {
  return typeof metric.celsius === 'number';
}

function hasSleep(metric: RingSleepMetric) {
  return [
    metric.score,
    metric.remMinutes,
    metric.deepMinutes,
    metric.lightMinutes,
    metric.awakeMinutes,
    metric.startTs,
    metric.endTs,
    metric.totalMinutes,
  ].some((v) => typeof v === 'number');
}

function hasActivity(metric: RingActivityMetric) {
  return [metric.steps, metric.calories, metric.distanceMeters].some(
    (v) => typeof v === 'number',
  );
}

function objectLike(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectObjects(input: any, depth = 0, out: any[] = []): any[] {
  if (depth > 5 || input == null) return out;

  if (Array.isArray(input)) {
    for (const item of input) collectObjects(item, depth + 1, out);
    return out;
  }

  if (objectLike(input)) {
    out.push(input);

    for (const key of [
      'data',
      'datas',
      'value',
      'values',
      'result',
      'results',
      'item',
      'items',
      'list',
      'rows',
      'records',
      'record',
      'payload',
      'detail',
      'details',
      'history',
      'historyData',
      'historyList',
      'sleepData',
      'sleep',
      'sleepList',
      'sleepSessions',
      'session',
      'sessions',
      'stagingList',
      'sleepStageList',
      'activeData',
      'summary',
      'summaries',
      'packet',
      'packets',
    ]) {
      if (key in input) collectObjects(input[key], depth + 1, out);
    }

    return out;
  }

  return out;
}

function uniqueMetrics(metrics: RingMetric[]) {
  const seen = new Set<string>();
  const out: RingMetric[] = [];

  for (const metric of metrics) {
    const key = JSON.stringify(metric);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(metric);
  }

  return out;
}

export function normalizeHealthMetric(raw: any): RingHealthMetric {
  return {
    ts: tsFrom(raw),
    hr: num(
      raw?.hr ??
        raw?.heartRate ??
        raw?.heart ??
        raw?.heart_rate ??
        raw?.bpm ??
        raw?.pulse,
    ),
    spo2: num(
      raw?.spo2 ??
        raw?.bloodOxygen ??
        raw?.oxygen ??
        raw?.ox ??
        raw?.bo,
    ),
    hrv: num(raw?.hrv ?? raw?.rmssd ?? raw?.sdnn ?? raw?.vitality),
    rr: num(
      raw?.rr ??
        raw?.respiratoryRate ??
        raw?.breathRate ??
        raw?.breathingRate,
    ),
    stress: num(raw?.stress ?? raw?.pressure ?? raw?.stressLevel),
    readiness: num(
      raw?.readiness ??
        raw?.recovery ??
        raw?.bodyScore ??
        raw?.recoveryScore,
    ),
    rhr: num(raw?.rhr ?? raw?.restingHr ?? raw?.restHeartRate),
    sleepAvgHr: num(
      raw?.sleepAvgHr ??
        raw?.sleepAverageHeartRate ??
        raw?.avgSleepHr ??
        raw?.sleepHeartRate,
    ),
    nightSpo2: num(
      raw?.nightSpo2 ??
        raw?.sleepSpo2 ??
        raw?.overnightSpo2 ??
        raw?.nightOxygen,
    ),
    sourceMode:
      raw?.sourceMode === 'live' ||
      raw?.sourceMode === 'history' ||
      raw?.sourceMode === 'sdk_calculated'
        ? raw.sourceMode
        : undefined,
  };
}

export function normalizeBatteryMetric(raw: any): RingBatteryMetric {
  return {
    ts: tsFrom(raw),
    pct: num(
      raw?.pct ??
        raw?.battery ??
        raw?.batteryPct ??
        raw?.power ??
        raw?.electricity,
    ),
    charging:
      typeof raw?.charging === 'boolean'
        ? raw.charging
        : typeof raw?.isCharging === 'boolean'
          ? raw.isCharging
          : typeof raw?.chargeState === 'boolean'
            ? raw.chargeState
            : undefined,
  };
}

export function normalizeTemperatureMetric(raw: any): RingTemperatureMetric {
  const c =
    num(raw?.celsius) ??
    num(raw?.tempC) ??
    num(raw?.temperature) ??
    num(raw?.bodyTemp) ??
    num(raw?.skinTemp) ??
    num(raw?.temp) ??
    num(raw?.temperatureValue);

  return {
    ts: tsFrom(raw),
    celsius: c,
  };
}

export function normalizeSleepMetric(raw: any): RingSleepMetric {
  const startTs =
    normalizeEpochMs(
      raw?.startTs ??
        raw?.startTimeStamp ??
        raw?.startTime ??
        raw?.sleepStart ??
        raw?.beginTs ??
        raw?.beginTime,
    );

  const endTs =
    normalizeEpochMs(
      raw?.endTs ??
        raw?.endTimeStamp ??
        raw?.endTime ??
        raw?.sleepEnd ??
        raw?.finishTs ??
        raw?.finishTime,
    );

  const flattened = flattenSleepStages(raw);

  const flatRem = num(
    raw?.remMinutes ??
      raw?.remSleepTime ??
      raw?.rem ??
      raw?.remSleep,
  );

  const flatDeep = num(
    raw?.deepMinutes ??
      raw?.deepSleepTime ??
      raw?.deep ??
      raw?.deepSleep,
  );

  const flatLight = num(
    raw?.lightMinutes ??
      raw?.lightSleepTime ??
      raw?.light ??
      raw?.lightSleep,
  );

  const flatAwake = num(
    raw?.awakeMinutes ??
      raw?.wakeSleepTime ??
      raw?.awake ??
      raw?.wake,
  );

  const remMinutes =
    typeof flatRem === 'number'
      ? flatRem
      : flattened.remMinutes || undefined;

  const deepMinutes =
    typeof flatDeep === 'number'
      ? flatDeep
      : flattened.deepMinutes || undefined;

  const lightMinutes =
    typeof flatLight === 'number'
      ? flatLight
      : flattened.lightMinutes || undefined;

  const awakeMinutes =
    typeof flatAwake === 'number'
      ? flatAwake
      : flattened.awakeMinutes || undefined;

  const explicitTotal = num(
    raw?.totalMinutes ??
      raw?.duration ??
      raw?.sleepMinutes ??
      raw?.totalSleep ??
      raw?.durationMinutes ??
      raw?.minutes,
  );

  const stagedTotal =
    (remMinutes ?? 0) +
    (deepMinutes ?? 0) +
    (lightMinutes ?? 0) +
    (awakeMinutes ?? 0);

  const durationFromBounds =
    typeof startTs === 'number' && typeof endTs === 'number' && endTs >= startTs
      ? Math.round((endTs - startTs) / 60000)
      : undefined;

  return {
    ts: tsFrom(raw),
    score: num(raw?.score ?? raw?.sleepScore),
    remMinutes,
    deepMinutes,
    lightMinutes,
    awakeMinutes,
    startTs,
    endTs,
    totalMinutes:
      explicitTotal ??
      durationFromBounds ??
      (stagedTotal > 0 ? stagedTotal : undefined),
    sourceMode:
      raw?.sourceMode === 'history' || raw?.sourceMode === 'sdk_calculated'
        ? raw.sourceMode
        : undefined,
  };
}

export function normalizeActivityMetric(raw: any): RingActivityMetric {
  return {
    ts: tsFrom(raw),
    steps: num(raw?.steps ?? raw?.step ?? raw?.totalSteps ?? raw?.walk),
    calories: num(raw?.calories ?? raw?.kcal ?? raw?.consumedCalories),
    distanceMeters: num(
      raw?.distanceMeters ??
        raw?.distance ??
        raw?.totalDistance ??
        raw?.distanceValue,
    ),
  };
}

export function normalizeDailySummary(raw: any): RingDailySummary {
  return {
    ts: tsFrom(raw),
    steps: num(raw?.steps ?? raw?.step ?? raw?.totalSteps),
    calories: num(raw?.calories ?? raw?.kcal),
    distanceMeters: num(
      raw?.distanceMeters ?? raw?.distance ?? raw?.totalDistance,
    ),
    walkingSteps: num(raw?.walkingSteps ?? raw?.walkSteps),
    runningSteps: num(raw?.runningSteps ?? raw?.runSteps),
    otherSteps: num(raw?.otherSteps),
    walkingDistanceMeters: num(
      raw?.walkingDistanceMeters ?? raw?.walkDistance,
    ),
    runningDistanceMeters: num(
      raw?.runningDistanceMeters ?? raw?.runDistance,
    ),
    otherDistanceMeters: num(raw?.otherDistanceMeters),
  };
}

export function normalizeDeviceInfo(raw: any): RingDeviceInfo {
  return {
    ts: tsFrom(raw),
    model: raw?.model ?? raw?.deviceModel ?? raw?.modelNumber,
    firmware: raw?.firmware ?? raw?.firmwareVersion,
    hardware: raw?.hardware ?? raw?.hardwareVersion,
    software: raw?.software ?? raw?.softwareVersion,
    manufacturer: raw?.manufacturer ?? raw?.vendor,
    mac: raw?.mac ?? raw?.address,
    color: raw?.color,
    size: raw?.size,
  };
}

export function normalizeCommandResult(raw: any): RingCommandResult {
  return {
    ts: tsFrom(raw),
    ok:
      typeof raw?.ok === 'boolean'
        ? raw.ok
        : typeof raw?.success === 'boolean'
          ? raw.success
          : undefined,
    code: raw?.code ?? raw?.resultCode ?? raw?.status,
    message: raw?.message ?? raw?.msg ?? raw?.reason,
    raw,
  };
}

function metricsFromCandidate(kind: string, raw: any): RingMetric[] {
  const out: RingMetric[] = [];

  const pushHealth = () => {
    const metric = normalizeHealthMetric(raw);
    if (hasHealth(metric)) out.push({ kind: 'health', ...metric });
  };

  const pushBattery = () => {
    const metric = normalizeBatteryMetric(raw);
    if (hasBattery(metric)) out.push({ kind: 'battery', ...metric });
  };

  const pushTemperature = () => {
    const metric = normalizeTemperatureMetric(raw);
    if (hasTemperature(metric)) out.push({ kind: 'temperature', ...metric });
  };

  const pushSleep = () => {
    const metric = normalizeSleepMetric(raw);
    if (hasSleep(metric)) out.push({ kind: 'sleep', ...metric });
  };

  const pushActivity = () => {
    const metric = normalizeActivityMetric(raw);
    if (hasActivity(metric)) out.push({ kind: 'activity', ...metric });
  };

  switch (kind) {
    case 'health':
      pushHealth();
      break;
    case 'battery':
      pushBattery();
      break;
    case 'temperature':
      pushTemperature();
      break;
    case 'sleep':
      pushSleep();
      pushHealth();
      break;
    case 'activity':
    case 'step':
    case 'active_data':
    case 'active_data_2':
      pushActivity();
      pushHealth();
      pushTemperature();
      break;
    case 'daily_summary': {
      const summary = normalizeDailySummary(raw);
      if (
        [
          summary.steps,
          summary.calories,
          summary.distanceMeters,
          summary.walkingSteps,
          summary.runningSteps,
          summary.walkingDistanceMeters,
          summary.runningDistanceMeters,
        ].some((v) => typeof v === 'number')
      ) {
        out.push({
          kind: 'activity',
          ts: summary.ts,
          steps: summary.steps,
          calories: summary.calories,
          distanceMeters: summary.distanceMeters,
        });
      }
      break;
    }
    case 'algorithm':
      pushHealth();
      pushSleep();
      pushTemperature();
      break;
    case 'history_row':
      pushHealth();
      pushActivity();
      pushTemperature();
      pushSleep();
      break;
    default:
      break;
  }

  return out;
}

export function bestMetricsFromListener(kind: string, raw: any): RingMetric[] {
  const candidates = collectObjects(raw);
  if (candidates.length === 0) {
    return uniqueMetrics(metricsFromCandidate(kind, raw));
  }

  const out: RingMetric[] = [];
  for (const candidate of candidates) {
    out.push(...metricsFromCandidate(kind, candidate));
  }

  return uniqueMetrics(out);
}

export function bestMetricFromListener(kind: string, raw: any): RingMetric | null {
  return bestMetricsFromListener(kind, raw)[0] ?? null;
}