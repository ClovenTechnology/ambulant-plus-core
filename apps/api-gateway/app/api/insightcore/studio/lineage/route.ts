// apps/api-gateway/app/api/insightcore/studio/lineage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isJsonCompatibleValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    typeof value === 'object'
  );
}

function safeJsonValue(value: unknown): unknown | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  return isJsonCompatibleValue(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');

  if (!patientId) {
    return NextResponse.json({ error: 'patientId_required' }, { status: 400 });
  }

  const event = await prisma.runtimeEvent.findFirst({
    where: {
      kind: 'insight.lineage.v1',
      patientId,
    },
    orderBy: { ts: 'desc' },
  });

  if (!event) {
    return NextResponse.json({ item: null });
  }

  return NextResponse.json({
    item: safeJsonValue(event.payload),
  });
}