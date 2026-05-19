export type LinktopMeasurementMode =
  | 'idle'
  | 'bp'
  | 'spo2'
  | 'ecg'
  | 'temp'
  | 'glucose';

export type LinktopRoute =
  | 'vendor_notify'
  | 'temp'
  | 'glucose'
  | 'therm_confirm'
  | 'battery'
  | 'unknown';

export type LinktopAckDecoded = {
  kind: 'ack';
  code?: number;
  raw: Uint8Array;
};

export type LinktopUnknownDecoded = {
  kind: 'unknown';
  raw: Uint8Array;
};

export type LinktopBatteryDecoded = {
  kind: 'battery';
  percent: number;
  raw: Uint8Array;
};

export type LinktopBpDecoded = {
  kind: 'bp_result';
  systolic: number;
  diastolic: number;
  map?: number | null;
  pulse?: number | null;
  irregular?: boolean;
  raw: Uint8Array;
};

export type LinktopSpo2Decoded = {
  kind: 'spo2_result';
  spo2: number;
  pulse?: number | null;
  pi?: number | null;
  raw: Uint8Array;
};

export type LinktopTempDecoded = {
  kind: 'temperature_result';
  celsius: number;
  fahrenheit?: number | null;
  raw: Uint8Array;
};

export type LinktopGlucoseDecoded = {
  kind: 'glucose_result';
  glucose: number;
  unit: 'mg/dL' | 'mmol/L';
  raw: Uint8Array;
};

export type LinktopEcgWaveDecoded = {
  kind: 'ecg_wave';
  sampleHz: number;
  samples: number[];
  raw: Uint8Array;
};

export type LinktopPpgWaveDecoded = {
  kind: 'ppg_wave';
  sampleHz: number;
  samples: number[];
  raw: Uint8Array;
};

export type LinktopDecoded =
  | LinktopAckDecoded
  | LinktopUnknownDecoded
  | LinktopBatteryDecoded
  | LinktopBpDecoded
  | LinktopSpo2Decoded
  | LinktopTempDecoded
  | LinktopGlucoseDecoded
  | LinktopEcgWaveDecoded
  | LinktopPpgWaveDecoded;