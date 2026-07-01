export type AmbulantDeviceProtocolVersion = 'ADP-1';

export type AmbulantDeviceSource =
  | 'native_android'
  | 'web_bluetooth'
  | 'ios_native'
  | 'desktop_bridge';

export type AmbulantDeviceVendor = 'linktop' | 'duecare' | string;

export type AmbulantDeviceKind =
  | 'health_monitor'
  | 'nexring'
  | 'stethoscope'
  | 'otoscope';

export type AmbulantDeviceMode = 'home' | 'televisit' | 'debug';

export type AmbulantMeasurement =
  | 'blood_pressure'
  | 'spo2'
  | 'temperature'
  | 'ecg'
  | 'heart_rate'
  | 'glucose'
  | 'auscultation'
  | 'otoscope';

export type AmbulantReadingStatus =
  | 'started'
  | 'in_progress'
  | 'complete'
  | 'partial'
  | 'aborted'
  | 'invalid'
  | 'error';

export type AmbulantSignalQuality = 'good' | 'fair' | 'poor' | 'unknown';

export type AmbulantConfidence =
  | 'manufacturer_final'
  | 'protocol_final'
  | 'threshold'
  | 'partial_threshold_fallback'
  | 'partial'
  | 'estimated'
  | 'debug';

export type AmbulantDeviceReading = {
  protocolVersion: AmbulantDeviceProtocolVersion;
  source: AmbulantDeviceSource;
  vendor: AmbulantDeviceVendor;
  deviceKind: AmbulantDeviceKind;
  deviceId: string;
  patientId?: string;
  roomId?: string;
  mode: AmbulantDeviceMode;
  measurement: AmbulantMeasurement;
  status: AmbulantReadingStatus;
  values: Record<string, number | string | boolean | null>;
  unitMap: Record<string, string>;
  quality: {
    signal?: AmbulantSignalQuality;
    confidence?: AmbulantConfidence;
    reason?: string | null;
  };
  recordedAt: string;
  raw?: unknown;
};

export type BuildAmbulantReadingInput = {
  source: AmbulantDeviceSource;
  vendor?: AmbulantDeviceVendor;
  deviceKind?: AmbulantDeviceKind;
  deviceId: string;
  patientId?: string;
  roomId?: string;
  mode?: AmbulantDeviceMode;
  measurement: AmbulantMeasurement;
  status?: AmbulantReadingStatus;
  values: Record<string, number | string | boolean | null>;
  unitMap?: Record<string, string>;
  quality?: AmbulantDeviceReading['quality'];
  recordedAt?: string;
  raw?: unknown;
};

export function buildAmbulantDeviceReading(
  input: BuildAmbulantReadingInput,
): AmbulantDeviceReading {
  const mode = input.mode ?? 'debug';

  return {
    protocolVersion: 'ADP-1',
    source: input.source,
    vendor: input.vendor ?? 'linktop',
    deviceKind: input.deviceKind ?? 'health_monitor',
    deviceId: input.deviceId,
    patientId: input.patientId,
    roomId: input.roomId,
    mode,
    measurement: input.measurement,
    status: input.status ?? 'complete',
    values: input.values,
    unitMap: input.unitMap ?? {},
    quality: input.quality ?? {
      signal: 'unknown',
      confidence: mode === 'debug' ? 'debug' : 'protocol_final',
      reason: null,
    },
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    raw: input.raw,
  };
}

export function buildHealthMonitorBpReading(input: {
  source: AmbulantDeviceSource;
  deviceId: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  map?: number | null;
  patientId?: string;
  roomId?: string;
  mode?: AmbulantDeviceMode;
  recordedAt?: string;
  manufacturerFinal?: boolean;
  confidence?: AmbulantConfidence;
  reason?: string | null;
  raw?: unknown;
}): AmbulantDeviceReading {
  return buildAmbulantDeviceReading({
    source: input.source,
    vendor: 'linktop',
    deviceKind: 'health_monitor',
    deviceId: input.deviceId,
    patientId: input.patientId,
    roomId: input.roomId,
    mode: input.mode ?? 'debug',
    measurement: 'blood_pressure',
    status: 'complete',
    values: {
      systolic: input.systolic,
      diastolic: input.diastolic,
      pulse: input.pulse ?? null,
      map: input.map ?? null,
    },
    unitMap: {
      systolic: 'mmHg',
      diastolic: 'mmHg',
      pulse: 'bpm',
      map: 'mmHg',
    },
    quality: {
      signal: 'unknown',
      confidence: input.manufacturerFinal
        ? 'manufacturer_final'
        : input.confidence ?? 'protocol_final',
      reason: input.reason ?? null,
    },
    recordedAt: input.recordedAt,
    raw: input.raw,
  });
}

export function isPersistableAmbulantReading(reading: AmbulantDeviceReading) {
  return (
    reading.mode !== 'debug' &&
    (reading.status === 'complete' || reading.status === 'partial') &&
    !!reading.patientId
  );
}

export function isTelevisitAmbulantReading(reading: AmbulantDeviceReading) {
  return reading.mode === 'televisit' && !!reading.roomId;
}