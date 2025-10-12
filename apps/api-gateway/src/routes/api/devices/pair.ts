// apps/api-gateway/src/routes/api/devices/pair.ts (Next.js handler)
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { deviceId, catalogSlug, userId } = body;
  if (!catalogSlug) return NextResponse.json({ error: 'catalogSlug required' }, { status: 400 });

  // upsert catalog
  await prisma.catalog.upsert({
    where: { slug: catalogSlug },
    update: { updatedAt: new Date() },
    create: { slug: catalogSlug, vendor: catalogSlug.split('.')[0] || 'unknown', label: catalogSlug },
  });

  // upsert user device: create if not exists for that user+slug
  const ud = await prisma.userDevice.upsert({
    where: { /* here use unique index if you add one, fallback to findUniqueNotAvailable: use findFirst then update or create */ },
    // simple approach using findFirst + conditional create/update:
  });

  // simpler: ensure one per user+catalog
  const existing = await prisma.userDevice.findFirst({ where: { userId, catalogSlug } });
  if (existing) {
    await prisma.userDevice.update({ where: { id: existing.id }, data: { deviceId: deviceId ?? existing.deviceId, paired: true, lastSeenAt: new Date() }});
  } else {
    await prisma.userDevice.create({ data: { userId, catalogSlug, deviceId: deviceId ?? null, paired: true, lastSeenAt: new Date() }});
  }

  return NextResponse.json({ ok: true });
}
