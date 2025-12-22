// apps/admin-dashboard/app/api/roles/requests/route.ts
import { NextResponse } from 'next/server';
import { roleReqStore } from '@/lib/rolerequests';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as any;
  return NextResponse.json({ items: roleReqStore.list(status) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rr = roleReqStore.create(body);
    return NextResponse.json(rr, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}
