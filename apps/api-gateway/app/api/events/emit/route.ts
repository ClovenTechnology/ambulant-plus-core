// apps/api-gateway/app/api/events/emit/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // For now, just log + return success (wire to real event bus later)
    console.log('[event_emit]', body);

    return NextResponse.json({ ok: true, received: body });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'event_emit_failed', detail: err.message },
      { status: 400 }
    );
  }
}
