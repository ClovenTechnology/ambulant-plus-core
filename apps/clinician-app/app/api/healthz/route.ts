// Lightweight health probe for UI badges (no crashing if LiveKit is down)
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 1500;

async function ping(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok || r.status === 404; // LiveKit often 404s on root; treat as "alive"
  } catch {
    clearTimeout(t);
    return false;
  }
}

export async function GET() {
  const now = new Date();
  const host = process.env.LIVEKIT_HOST || 'http://localhost:7880';

  const [livekitUp] = await Promise.all([
    ping(host), // tolerant: OK or 404 => up
  ]);

  return NextResponse.json({
    ok: true,
    time: now.toISOString(),
    livekit: livekitUp ? 'up' : 'down',
    // keep output tiny; don’t leak secrets
    env: {
      LIVEKIT_HOST: host,
      NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'unset',
    },
  });
}
