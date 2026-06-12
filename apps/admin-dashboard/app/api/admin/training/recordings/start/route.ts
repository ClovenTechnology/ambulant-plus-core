import { NextRequest, NextResponse } from 'next/server';
import { proxyRecordingRequest } from '../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  return proxyRecordingRequest(req, '/api/admin/training/recordings/start', 'POST');
}
