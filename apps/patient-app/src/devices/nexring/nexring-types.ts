// apps/patient-app/src/devices/nexring/nexring-types.ts
// apps/patient-app/src/devices/nexring/nexring-types.ts
export type RingConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

export type RingScanDevice = {
  id: string;
  mac?: string;
  name?: string;
  rssi?: number;
  isConnectable?: boolean;
  advBase64?: string;
  advMac?: string;
  advMeta?: unknown;
};

export type RingBatteryMetric = {
  ts: number;
  pct?: number;
  charging?: boolean;
};

export type RingHealthMetric = {
  ts: number;
  hr?: number;
  spo2?: number;
  hrv?: number;
  rr?: number;
  stress?: number;
  readiness?: number;
  rhr?: number;
  sleepAvgHr?: number;
  nightSpo2?: number;
  sourceMode?: 'live' | 'history' | 'sdk_calculated';
};

export type RingTemperatureMetric = {
  ts: number;
  celsius?: number;
};

export type RingSleepMetric = {
  ts: number;
  score?: number;
  remMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
  startTs?: number;
  endTs?: number;
  totalMinutes?: number;
  sourceMode?: 'history' | 'sdk_calculated';
};

export type RingActivityMetric = {
  ts: number;
  steps?: number;
  calories?: number;
  distanceMeters?: number;
};

export type RingHistoricalMetric =
  | ({ kind: 'health' } & RingHealthMetric)
  | ({ kind: 'battery' } & RingBatteryMetric)
  | ({ kind: 'temperature' } & RingTemperatureMetric)
  | ({ kind: 'sleep' } & RingSleepMetric)
  | ({ kind: 'activity' } & RingActivityMetric);

export type RingMetric =
  | ({ kind: 'battery' } & RingBatteryMetric)
  | ({ kind: 'health' } & RingHealthMetric)
  | ({ kind: 'temperature' } & RingTemperatureMetric)
  | ({ kind: 'sleep' } & RingSleepMetric)
  | ({ kind: 'activity' } & RingActivityMetric);

export type RingDeviceInfo = {
  ts: number;
  model?: string;
  firmware?: string;
  hardware?: string;
  software?: string;
  manufacturer?: string;
  mac?: string;
  color?: string;
  size?: string;
};

export type RingCommandResult = {
  ts: number;
  ok?: boolean;
  code?: number | string;
  message?: string;
  raw?: unknown;
};

export type RingTraceEvent = {
  ts: number;
  direction: 'tx' | 'rx' | 'sdk';
  label: string;
  code?: string | number;
  family?: string;
  hex?: string;
  ok?: boolean;
  parser?: string;
  message?: string;
  raw?: unknown;
};

export type RingHydrationState = {
  phase:
    | 'idle'
    | 'requested_count'
    | 'requested_data'
    | 'receiving'
    | 'complete';
  requestedAt?: number;
  receivedPackets: number;
  receivedMetrics: number;
  countEstimate?: number;
  lastPacketCmd?: number;
  lastPacketTs?: number;
  familyCounts: Partial<Record<string, number>>;
  algorithmPackets: number;
  activePackets: number;
  sleepPackets: number;
  historyErrorPackets: number;
};

export type RingDailySummary = {
  ts: number;
  steps?: number;
  calories?: number;
  distanceMeters?: number;
  walkingSteps?: number;
  runningSteps?: number;
  otherSteps?: number;
  walkingDistanceMeters?: number;
  runningDistanceMeters?: number;
  otherDistanceMeters?: number;
};

export type RingReportSnapshot = {
  hydration: RingHydrationState;
  sleepSessions: Array<{
    id: string;
    startTs: number;
    endTs: number;
    totalMinutes: number;
    score?: number;
    stages: {
      awake?: number;
      rem?: number;
      light?: number;
      deep?: number;
    };
  }>;
  dailySummary: RingDailySummary | null;
  derived?: {
    rhr?: number;
    sleepAvgHr?: number;
    nightSpo2?: number;
    rr?: number;
  };
};

export type RingSessionState = {
  phase: RingConnectionState;
  connectedDevice?: RingScanDevice | null;
  lastError?: string | null;
  lastSeenTs?: number | null;
  mtu?: number | null;
  batteryPct?: number | null;
};

export type RingSessionCallbacks = {
  onState?: (state: RingSessionState) => void;
  onMetric?: (metric: RingMetric) => void;
  onHistoricalMetric?: (metric: RingHistoricalMetric) => void;
  onDeviceInfo?: (info: RingDeviceInfo) => void;
  onCommandResult?: (result: RingCommandResult) => void;
  onTrace?: (trace: RingTraceEvent) => void;
  onHydration?: (state: RingHydrationState) => void;
  onReportSnapshot?: (snapshot: RingReportSnapshot) => void;
  onScan?: (device: RingScanDevice) => void;
  onError?: (message: string) => void;
};