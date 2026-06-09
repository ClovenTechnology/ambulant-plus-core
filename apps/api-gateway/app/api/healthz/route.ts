import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ambulant-plus-api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
