/** Upload a short stethoscope audio segment for later replay/QA. */
export async function uploadStethSegment(blob: Blob, opts: {
  patient_id: string; room_id?: string; hr?: number; rms?: number;
}) {
  const form = new FormData();
  form.append('file', blob, `steth_${Date.now()}.opus`);
  form.append('meta', JSON.stringify({ ...opts, t: new Date().toISOString(), type: 'steth_segment' }));
  const r = await fetch('/api/devices/ingest', { method: 'POST', body: form });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  return r.json();
}
