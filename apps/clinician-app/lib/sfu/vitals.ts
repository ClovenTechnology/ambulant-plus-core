// Normalize vitals data from multiple source schemas
export type NormalizedVitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
  glu?: number; // blood glucose (normalized)
  [k: string]: any;
};

function numOrUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

export function normalizeVitals(raw: any): NormalizedVitals {
  if (!raw || typeof raw !== 'object') return {};

  // Blood pressure
  const sys = numOrUndefined(
    raw.sys ?? raw.bpSys ?? raw.sbp ?? raw.bp?.sys
  );
  const dia = numOrUndefined(
    raw.dia ?? raw.bpDia ?? raw.dbp ?? raw.bp?.dia
  );

  // Heart rate
  const hr = numOrUndefined(
    raw.hr ??
      raw.heartRate ??
      raw.hr_bpm ??
      raw.pulse ??
      raw.HeartRate
  );

  // Oxygen saturation
  const spo2 = numOrUndefined(
    raw.spo2 ??
      raw.SpO2 ??
      raw.spO2 ??
      raw.oxygenSaturation ??
      raw.spo2Percent
  );

  // Temperature (normalize to °C; convert from F if that’s all we have)
  let tempC = numOrUndefined(
    raw.tempC ?? raw.temperatureC ?? raw.temp_c
  );
  if (tempC === undefined) {
    const tempF = numOrUndefined(
      raw.tempF ?? raw.temperatureF ?? raw.temp_f
    );
    if (tempF !== undefined) {
      tempC = ((tempF - 32) * 5) / 9;
    }
  }

  // Respiratory rate
  const rr = numOrUndefined(
    raw.rr ??
      raw.respRate ??
      raw.respiratoryRate ??
      raw.RR
  );

  // Glucose – support a bunch of possible keys
  const glu = numOrUndefined(
    raw.glu ??
      raw.glucose ??
      raw.bgl ??
      raw.bloodGlucose ??
      raw.bg ??
      raw.glucoseMmolL ??
      raw.glucoseMgDl
  );

  return {
    ...raw,
    ...(sys !== undefined ? { sys } : {}),
    ...(dia !== undefined ? { dia } : {}),
    ...(hr !== undefined ? { hr } : {}),
    ...(spo2 !== undefined ? { spo2 } : {}),
    ...(tempC !== undefined ? { tempC } : {}),
    ...(rr !== undefined ? { rr } : {}),
    ...(glu !== undefined ? { glu } : {}),
  };
}
