import { NextResponse } from 'next/server';
import { configuredGatewayBase } from '@/src/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'insightcore-studio',
      gatewayConfigured: Boolean(configuredGatewayBase())
    },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
}