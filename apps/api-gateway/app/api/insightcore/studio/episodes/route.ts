// apps/api-gateway/app/api/insightcore/studio/episodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonObject(value: unknown): Record<string, any> | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(value) ? value : null;
}

function safeNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId') || undefined;
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;

  const events = await prisma.runtimeEvent.findMany({
    where: {
      kind: 'insight.episode.v1',
      ...(patientId ? { patientId } : {}),
      ...(orgId ? { orgId } : {}),
    },
    orderBy: { ts: 'desc' },
    take: 100,
  });

  const items = events.flatMap((ev) => {
    const payload = safeJsonObject(ev.payload);
    if (!payload) return [];

    return [
      {
        id: safeStringOrNull(payload.id) ?? ev.id,
        patientId: ev.patientId,
        title: safeStringOrNull(payload.title),
        syndrome: safeStringOrNull(payload.syndrome),
        severity: safeStringOrNull(payload.severity),
        status: safeStringOrNull(payload.status),
        updatedAt:
          safeStringOrNull(payload.updatedAt) ??
          new Date(Number(ev.ts)).toISOString(),
        riskScore: safeNumberOrNull(payload.riskScore),
      },
    ];
  });

  return NextResponse.json({ items });
}