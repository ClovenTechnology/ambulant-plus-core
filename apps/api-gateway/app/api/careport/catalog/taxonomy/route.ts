import { NextResponse } from 'next/server';
import { carePortCatalogueTaxonomy } from '@/src/careport/catalogue/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ...carePortCatalogueTaxonomy(),
    aliasOf: '/api/careport/catalogue/taxonomy',
  }, {
    status: 200,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
    },
  });
}
