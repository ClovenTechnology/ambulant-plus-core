// apps/api-gateway/app/api/devices/seed/route.ts
import { NextResponse } from 'next/server';
import { seedDeviceCatalog } from '@/src/devices/seed';

export const dynamic = 'force-dynamic';

export async function POST() {
  await seedDeviceCatalog();
  return NextResponse.json({ ok: true });
}
