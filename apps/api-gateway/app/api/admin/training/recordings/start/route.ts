import { NextRequest, NextResponse } from 'next/server';
import {
  cors,
  egressClient,
  errorStatus,
  json,
  recordingPrefix,
  requireRecordingAdmin,
  safeRoomId,
  s3UploadConfig,
} from '../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest) {
  try {
    requireRecordingAdmin(req);

    const body = await req.json().catch(() => ({} as any));
    const roomId = safeRoomId(body?.roomId);
    const layout = String(body?.layout || 'grid').trim() || 'grid';

    const prefix = recordingPrefix(roomId);
    const filepath = prefix + '/room-composite.mp4';

    const lk = await egressClient();
    const {
      EncodedFileOutput,
      EncodingOptionsPreset,
    } = await import('livekit-server-sdk');

    const output = new EncodedFileOutput({
      filepath,
      output: {
        case: 's3',
        value: s3UploadConfig(),
      },
    });

    const started = await lk.startRoomCompositeEgress(roomId, output, {
      layout,
      encodingOptions: EncodingOptionsPreset.H264_720P_30,
      audioOnly: false,
      videoOnly: false,
    });

    return json(req, {
      ok: true,
      roomId,
      layout,
      egressId: (started as any)?.egressId || (started as any)?.egress_id || null,
      status: (started as any)?.status || null,
      filepath,
      s3Prefix: prefix,
      recording: started,
    });
  } catch (e: any) {
    const message = String(e?.message || 'start_recording_failed');

    return json(
      req,
      {
        ok: false,
        error: 'start_recording_failed',
        message,
      },
      errorStatus(message),
    );
  }
}
