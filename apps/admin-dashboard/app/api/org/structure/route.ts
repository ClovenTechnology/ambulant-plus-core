// apps/admin-dashboard/app/api/org/structure/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';

export async function GET() {
  try {
    const data = orgdb.structure();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
