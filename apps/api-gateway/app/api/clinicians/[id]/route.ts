// apps/api-gateway/app/api/clinicians/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

// Import mock clinicians directly for fallback
import { CLINICIANS } from '@/mock/clinicians';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    // 1. Try DB first
    const dbClin = await prisma.clinicianProfile.findFirst({
      where: { userId: id },
    });

    if (dbClin) {
      return NextResponse.json({
        id: dbClin.userId,
        name: dbClin.name || dbClin.userId,
        cls: dbClin.cls || 'Doctor',
        specialty: dbClin.specialty || 'General Practice',
        location: dbClin.location || 'Johannesburg',
        rating: dbClin.rating ?? 4.0,
        priceZAR: dbClin.feeCents / 100,
        online: dbClin.online ?? false,
        policy: {
          within24hPercent: 50,
          noShowPercent: 0,
          clinicianMissPercent: 100,
          networkProrate: true,
        },
      });
    }

    // 2. Fallback to mock clinicians
    const mockClin = CLINICIANS.find((c) => c.id === id);
    if (mockClin) {
      return NextResponse.json({
        ...mockClin,
        policy: {
          within24hPercent: 50,
          noShowPercent: 0,
          clinicianMissPercent: 100,
          networkProrate: true,
        },
      });
    }

    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
