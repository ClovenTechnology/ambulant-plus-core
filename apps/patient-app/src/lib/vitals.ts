// apps/patient-app/src/lib/vitals.ts
export type VitalsType =
  | 'blood_pressure'
  | 'spo2'
  | 'temperature'
  | 'heart_rate'
  | 'blood_glucose'
  | 'ecg';

export async function emitVital(patientId: string, type: VitalsType, payload: any) {
  const r = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/vitals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload, recorded_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`emitVital failed: ${r.status}`);
  return r.json();
}
