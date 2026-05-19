import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  try {
    await prisma.runtimeEvent.create({
      data: {
        id: crypto.randomUUID(),
        ts: BigInt(Date.now()),
        kind: 'insight.learning.interaction',
        patientId: body.patientId || null,
        clinicianId: body.clinicianId || null,
        orgId: body.orgId || 'org-default',
        payload: JSON.stringify(body),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}