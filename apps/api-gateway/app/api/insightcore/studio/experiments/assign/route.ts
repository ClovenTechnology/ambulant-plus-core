import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId || 'org-default';

  await prisma.runtimeEvent.create({
    data: {
      id: crypto.randomUUID(),
      ts: BigInt(Date.now()),
      kind: 'insight.experiment.update',
      orgId,
      payload: JSON.stringify(body),
    },
  });

  return NextResponse.json({ ok: true });
}