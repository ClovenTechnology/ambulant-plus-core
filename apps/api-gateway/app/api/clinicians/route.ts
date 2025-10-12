// apps/api-gateway/app/api/clinicians/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { CLINICIANS } from '@/mock/clinicians';

// Fallback helper: map mock to DB shape
function mapMock(c: any) {
  return {
    id: c.id,
    cls: c.cls,
    name: c.name,
    specialty: c.specialty,
    location: c.location,
    rating: c.rating,
    feeCents: c.priceZAR * 100,
    currency: 'ZAR',
    online: c.online,
  };
}

export async function GET() {
  try {
    const dbClinicians = await prisma.clinician.findMany({
      orderBy: { name: 'asc' },
    });

    // If DB has clinicians, use them, otherwise fallback to mock
    if (dbClinicians.length > 0) {
      return NextResponse.json(dbClinicians);
    } else {
      return NextResponse.json(CLINICIANS.map(mapMock));
    }
  } catch (e: any) {
    console.error('Clinicians fetch failed:', e);
    // Always fallback to mock in case of DB error
    return NextResponse.json(CLINICIANS.map(mapMock), { status: 200 });
  }
}
