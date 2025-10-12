// apps/clinician-app/app/api/record/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Safe, zero-regression handler.
 * - If @livekit/server-sdk is NOT installed, returns { ok:true, simulated:true }.
 * - If it's available, you can wire real egress later (left as a stub).
 * - Never throws; never breaks the UI.
 */
export async function POST(req: NextRequest) {
  try {
    const { action, roomId } = await req.json();
    const host = process.env.LIVEKIT_HOST || 'http://localhost:7880';
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

    // Try to load server-sdk ONLY at runtime (avoid build-time resolution).
    let S: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const reqAny = (eval as unknown as (s: string) => any)('require');
      S = reqAny('@livekit/server-sdk');
    } catch {
      // Not installed → simulate success, keep UI happy.
      return NextResponse.json({ ok: true, simulated: true, action, roomId });
    }

    // If you want real egress later, put it here. For now, simulate success:
    // const client = new S.EgressClient(host, apiKey, apiSecret);
    // if (action === 'start') { ... }
    // if (action === 'stop')  { ... }

    return NextResponse.json({ ok: true, host, action, roomId, simulated: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'record error' },
      { status: 200 } // still 200 to avoid tripping UI; purely informational
    );
  }
}
