// apps/api-gateway/app/api/rtc/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cors } from './_lib';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: cors(req),
  });
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      ok: true,
      service: 'rtc',
      endpoints: {
        token: '/api/rtc/token',
        roomEnd: '/api/rtc/admin/room/end',
        roomLock: '/api/rtc/admin/room/lock',
        participantRemove: '/api/rtc/admin/participant/remove',
      },
    },
    {
      headers: cors(req),
    },
  );
}

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: 'unsupported_rtc_root_action',
      message:
        'Use /api/rtc/token, /api/rtc/admin/room/end, /api/rtc/admin/room/lock, or /api/rtc/admin/participant/remove.',
    },
    {
      status: 405,
      headers: cors(req),
    },
  );
}