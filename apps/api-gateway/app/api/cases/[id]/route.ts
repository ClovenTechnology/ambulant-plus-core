// apps/api-gateway/app/api/cases/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function caseDelegate() {
  return (prisma as any).case ?? (prisma as any).clinicalCase ?? null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const delegate = caseDelegate();

  if (!delegate?.findUnique) {
    return NextResponse.json(
      { error: 'case_store_unavailable' },
      { status: 503 },
    );
  }

  const c = await delegate.findUnique({
    where: { id: params.id },
    include: {
      encounters: true,
    },
  });

  if (!c) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(c);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const delegate = caseDelegate();

  if (!delegate?.update) {
    return NextResponse.json(
      { error: 'case_store_unavailable' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const data: Record<string, any> = {};

  if (body.status !== undefined) data.status = String(body.status);
  if (body.priority !== undefined) data.priority = String(body.priority);
  if (body.title !== undefined) data.title = String(body.title);
  if (body.summary !== undefined) data.summary = String(body.summary);
  if (body.notes !== undefined) data.notes = String(body.notes);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no_update_fields' }, { status: 400 });
  }

  try {
    const updated = await delegate.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    if (String(err?.code || '') === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: err?.message || 'update_failed' },
      { status: 500 },
    );
  }
}