import { NextRequest, NextResponse } from 'next/server';
import { cors, egressClient, errorStatus, json, requireRecordingAdmin } from '../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req: NextRequest) {
  try {
    requireRecordingAdmin(req);

    const roomId = req.nextUrl.searchParams.get('roomId') || '';
    const lk = await egressClient();

    const recordings = roomId
      ? await lk.listEgress({ roomName: roomId } as any)
      : await lk.listEgress();

    return json(req, {
      ok: true,
      roomId: roomId || null,
      recordings,
    });
  } catch (e: any) {
    const message = String(e?.message || 'list_recordings_failed');

    return json(
      req,
      {
        ok: false,
        error: 'list_recordings_failed',
        message,
      },
      errorStatus(message),
    );
  }
}
