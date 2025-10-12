import { NextRequest, NextResponse } from 'next/server';

// same global DB
const DB: { appts: Record<string, any> } = (global as any).__DB__ ?? { appts: {} };
(global as any).__DB__ = DB;

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const a = DB.appts[params.id];
  if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(a);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const a = DB.appts[params.id];
  if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.status) a.status = body.status;
  if (body.roomId) a.roomId = body.roomId;
  return NextResponse.json(a);
}
