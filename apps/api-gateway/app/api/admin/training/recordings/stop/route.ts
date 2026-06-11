import { NextRequest, NextResponse } from 'next/server';
import { cors, egressClient, errorStatus, json, requireRecordingAdmin } from '../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest) {
  try {
    requireRecordingAdmin(req);

    const body = await req.json().catch(() => ({} as any));
    const egressId = String(body?.egressId || body?.egress_id || '').trim();

    if (!egressId) throw new Error('missing_egress_id');

    const lk = await egressClient();
    const stopped = await lk.stopEgress(egressId);

    return json(req, {
      ok: true,
      egressId,
      recording: stopped,
    });
  } catch (e: any) {
    const message = String(e?.message || 'stop_recording_failed');

    return json(
      req,
      {
        ok: false,
        error: 'stop_recording_failed',
        message,
      },
      errorStatus(message),
    );
  }
}
