import { NextResponse } from 'next/server';
import { PathwayFamilyRegistry } from '@/../../packages/insightcore/src/pathways/families/PathwayFamilyRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    items: new PathwayFamilyRegistry().list(),
  });
}