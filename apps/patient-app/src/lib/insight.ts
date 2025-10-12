// Minimal client for InsightCore mock: ingest frames + live SSE annotations.

export type InsightModality = 'pcm'|'ppg'|'ecg'|'video'|'image';
const BASE = process.env.NEXT_PUBLIC_CLIN_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || '';

export async function pushInsightFrame(sessionId: string, modality: InsightModality, payload: any) {
  await fetch(`${BASE}/api/insight/ingest`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({ sessionId, modality, payload }),
  });
}

export function openInsightStream(sessionId: string, onMsg: (label: any) => void) {
  const es = new EventSource(`${BASE}/api/insight/stream?session=${encodeURIComponent(sessionId)}`);
  const h = (e: MessageEvent) => {
    try { onMsg(JSON.parse(e.data)); } catch {}
  };
  es.addEventListener('message', h as any);
  es.addEventListener('insight', h as any);
  return () => { try { es.close(); } catch {} };
}
