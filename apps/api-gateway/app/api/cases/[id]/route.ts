// apps/api-gateway/app/api/cases/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function cors(json: any, status = 200) {
  return NextResponse.json(json, { status, headers: { 'access-control-allow-origin': '*' } });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: { encounters: true },
  });
  if (!c) return cors({ error: 'not_found' }, 404);
  return cors(c);
}

// PATCH title/status (no delete)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(()=> ({}));
  const data: any = {};
  if (typeof b.title === 'string') data.title = b.title.slice(0, 150);
  if (b.status && ['open','closed','archived'].includes(b.status)) data.status = b.status;
  if (!Object.keys(data).length) return cors({ error: 'no_fields' }, 400);

  const row = await prisma.case.update({ where: { id: params.id }, data });
  return cors(row);
}
