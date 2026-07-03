import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

/**
 * Production-safe recording endpoint.
 *
 * Recording is intentionally fail-closed until a real LiveKit Egress workflow
 * is wired through the server-side gateway/worker path.
 *
 * Never return simulated success and never use dev LiveKit credentials.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const action = clean(body?.action).toLowerCase();
  const roomId = clean(body?.roomId);

  if (!roomId) {
    return json(
      {
        ok: false,
        error: 'room_id_required',
        message: 'Recording requires a LiveKit roomId.',
      },
      400,
    );
  }

  if (action !== 'start' && action !== 'stop') {
    return json(
      {
        ok: false,
        error: 'unsupported_recording_action',
        message: 'Recording action must be start or stop.',
      },
      400,
    );
  }

  return json(
    {
      ok: false,
      error: 'recording_not_configured',
      message:
        'LiveKit Egress recording is not enabled for production yet. Use the transcript/caption workflow for this launch.',
      action,
      roomId,
    },
    503,
  );
}
