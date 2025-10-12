//apps/api-gateway/src/app/api/erx/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return cors(NextResponse.json({ error: 'id required' }, { status: 400 }));

  const events = await prisma.erxEvent.findMany({
    where: { scriptId: String(id) },
    orderBy: { at: 'asc' },
  });

  const timeline = events.map(e => ({ status: e.status, at: e.at.toISOString() }));
  return cors(NextResponse.json({ id, timeline }));
}
