// apps/api-gateway/app/api/insight/frame/route.ts
export const dynamic = 'force-dynamic';

declare const global: any;
if (!global.__INSIGHT_CLIENTS__) global.__INSIGHT_CLIENTS__ = [];
type Client = { id: string; session: string; controller: ReadableStreamDefaultController<Uint8Array> };
const getClients = (): Client[] => global.__INSIGHT_CLIENTS__ || [];

function sse(data: any, event?: string) {
  const head = event ? `event: ${event}\n` : '';
  return new TextEncoder().encode(`${head}data: ${JSON.stringify(data)}\n\n`);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, authorization',
    },
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as any;
  if (!b || !b.kind) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'content-type': 'application/json' },
    });
  }

  const session = b.sessionId || b.roomId || b.session || 'default';
  const kind = String(b.kind);
  const ts = Number.isFinite(b.ts) ? b.ts : Date.now();
  const sampleRate = b.sampleRate;
  const cadenceHz  = b.cadenceHz;
  const payloadB64 = b.payloadB64 || (typeof b.payload === 'string' ? b.payload : undefined);
  const mime = b.mime || (kind.includes('photo') || kind.includes('image') ? 'image/jpeg' : undefined);

  // Lightweight demo annotation
  let annotation: any = null;
  if (kind.includes('steth') || kind === 'pcm' || kind === 'stethoscope_pcm16') {
    annotation = { type: 'audio', label: 'murmur: none', conf: 0.92 };
  } else if (kind.includes('ecg')) {
    annotation = { type: 'ecg', label: 'rhythm: sinus', hr: 72, arrhythmia: 'none', conf: 0.88 };
  } else if (kind.includes('ppg')) {
    annotation = { type: 'ppg', label: 'signal ok', spo2_est: 97, hr: 70 };
  } else if (kind.includes('photo') || kind.includes('image') || kind.includes('video') || kind.includes('otoscope')) {
    annotation = { type: 'image', label: 'no otitis detected', conf: 0.81 };
  }

  // Broadcast raw frame + annotation
  for (const c of getClients()) {
    if (c.session === session) {
      try {
        c.controller.enqueue(sse({ kind, ts, sampleRate, cadenceHz, b64: payloadB64, mime }, 'frame'));
        if (annotation) c.controller.enqueue(sse({ kind, ts, annotation }, 'ai'));
      } catch {}
    }
  }

  return new Response(JSON.stringify({ ok: true, annotation }), {
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
