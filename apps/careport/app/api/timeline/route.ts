// apps/careport/app/api/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TIMELINE } from '../jobs/data';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || 'CP-1001';
  const timeline = TIMELINE[id] ?? [];
  return NextResponse.json({ id, timeline });
}
