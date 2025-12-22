// apps/patient-app/app/api/_lib/broadcaster.ts
/* Simple in-memory broadcaster for SSE. In production replace with Redis/Kafka or real push layer. */
type SseClient = {
  id: number;
  res: any; // Node response-like writable stream
};

let clients: SseClient[] = [];
let nextId = 1;

/* In-memory vitals + annotations store (mock) */
export const VITALS: any[] = []; // push plain objects matching Vital
export const ANNOTATIONS: Record<string, Array<{ text: string; ts: string }>> = {};

export function addVital(vital: any) {
  VITALS.unshift(vital); // newest first
  // keep a small history for demo
  if (VITALS.length > 500) VITALS.pop();
  broadcast('vital', vital);
}

export function addAnnotation(vitalId: string, text: string) {
  const arr = ANNOTATIONS[vitalId] || (ANNOTATIONS[vitalId] = []);
  const note = { text, ts: new Date().toISOString() };
  arr.push(note);
  broadcast('annotation', { vitalId, note });
  return note;
}

export function getVitalsSnapshot() {
  return VITALS.slice();
}

/* Basic insights mock (NexRing) */
export function getWearableInsights() {
  return {
    generatedAt: new Date().toISOString(),
    sleep_score: Math.round(60 + Math.random() * 40), // 60-100
    hrv_ms: +(20 + Math.random() * 80).toFixed(1),
    readiness: Math.round(40 + Math.random() * 60),
    restful_minutes: 120 + Math.round(Math.random() * 180),
  };
}

/* SSE management */
export function addClient(res: any) {
  const id = nextId++;
  const client: SseClient = { id, res };
  clients.push(client);
  return id;
}

export function removeClient(id: number) {
  clients = clients.filter(c => c.id !== id);
}

export function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => {
    try {
      c.res.write(payload);
    } catch (e) {
      // ignore write errors
    }
  });
}
