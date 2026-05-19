//apps/patient-app/src/lib/stethoscope-types.ts
export type StethStreamKind = 'raw' | 'filtered';

export type StethCaptureState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'capturing'
  | 'stopping'
  | 'finalizing'
  | 'error';

export type StethBodySite =
  | 'chest-apex'
  | 'chest-base'
  | 'chest-left'
  | 'chest-right'
  | 'back-upper'
  | 'back-lower'
  | 'neck'
  | 'other';

export type StethEchoMode = 'heart' | 'lung';

export type StethRecordingStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export type StethQuickAnalysis = {
  rms: number;
  peak: number;
  clipPct: number;
  dc: number;
  zcrPerSec: number;
};

export type StethWaveformSummary = {
  peaks: number[];
  analysis: StethQuickAnalysis;
  durationMs: number;
  sampleCount: number;
};

export type StethTelemetry = {
  updatedAt: number;
  connected?: boolean;
  deviceName?: string;
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  batteryPct?: number | null;
  volumeLevel?: number | null;
  echoMode?: StethEchoMode | null;
  agcGain?: number | null;
};

export type StethConsentMeta = {
  recorded: boolean;
  source: 'manual' | 'televisit';
  consentId?: string;
  acceptedAt?: string;
  consentVersion?: string;
};

export type StethAuditMeta = {
  recordedByUid?: string;
  recordedByRole?: 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
  deviceId?: string;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
};

export type StethAttachmentRefs = {
  visitId?: string;
  roomId?: string;
  appointmentId?: string;
  encounterId?: string;
};

export type StethClipMeta = {
  id: string;
  patientId: string;
  createdAt: string;
  durationMs: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  site: StethBodySite;
  note?: string;
  streamKind: StethStreamKind;
  echoMode?: StethEchoMode;
  agcGain?: number | null;
  quality?: 'unknown' | 'good' | 'noise';
  peaks?: number[];
  analysis?: StethQuickAnalysis;
  sessionId?: string;
  stepIndex?: number;
  visitId?: string;
  roomId?: string;
  appointmentId?: string;
  encounterId?: string;
  consent?: StethConsentMeta;
  audit?: StethAuditMeta;
  status: StethRecordingStatus;
  attempts: number;
  lastError?: string;
  uploadedAt?: string;
  serverRef?: string;
  serverUrl?: string;
};

export type StethSessionBundle = {
  id: string;
  patientId: string;
  createdAt: string;
  durationSec: number;
  steps: Array<{ site: StethBodySite; clipId?: string }>;
  summaryNote?: string;
  status: 'in_progress' | 'complete';
};

export type StethNativeStatusEvent = {
  type: 'status';
  connected: boolean;
  batteryPct?: number | null;
  volumeLevel?: number | null;
  echoMode?: number | null;
  agcGain?: number | null;
  deviceName?: string | null;
  deviceId?: string | null;
};

export type StethNativeAudioEvent = {
  type: 'audioFrame' | 'rawAudioFrame' | 'filteredAudioFrame';
  pcm16Base64: string;
  sampleRate: number;
  channels: number;
  ts: number;
};

export type StethNativeNoteEvent = {
  type: 'note';
  text: string;
  ts?: number;
};

export type StethNativeResultEvent = {
  type: 'result';
  heartRate?: number | null;
  ts: number;
};

export type StethNativeExceptionEvent = {
  type: 'exception';
  code?: number | null;
  message?: string | null;
  ts: number;
};

export type StethNativeSyncEvent = {
  type: 'sync';
  inProgress: boolean;
  ts: number;
};

export type StethNativeEvent =
  | StethNativeStatusEvent
  | StethNativeAudioEvent
  | StethNativeNoteEvent
  | StethNativeResultEvent
  | StethNativeExceptionEvent
  | StethNativeSyncEvent;

export type StethSessionState = {
  captureState: StethCaptureState;
  connected: boolean;
  recording: boolean;
  packets: number;
  sampleRate: number;
  channels: number;
  streamKind: StethStreamKind;
  site: StethBodySite;
  echoMode: StethEchoMode;
  agcGain: number;
  telemetry: StethTelemetry;
  startedAt: number | null;
  elapsedMs: number;
  lastError: string | null;
  live?: {
    rms: number;
    peak: number;
    clipPct: number;
    dc: number;
    zcrPerSec: number;
  };
};