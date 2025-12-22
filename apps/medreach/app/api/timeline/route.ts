import { NextRequest, NextResponse } from 'next/server';
import { TIMELINE } from '../jobs/data';

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || 'LAB-2001';
  const timeline = TIMELINE[id] ?? [];
  return NextResponse.json({ id, timeline });
}
