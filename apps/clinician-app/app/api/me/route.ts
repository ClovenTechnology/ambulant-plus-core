// apps/clinician-app/app/api/me/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

// If you already have session helpers / Auth0 integration elsewhere,
// you can swap the "current user" resolution logic below to match that.
export async function GET() {
  try {
    // TODO: replace this with your real session / auth lookup.
    // For now this just picks the first clinician as a dev default.
    const clinician = await prisma.clinicianProfile.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!clinician) {
      return NextResponse.json(
        {
          ok: true,
          // dev fallback – keeps dashboard working even if no record yet
          clinicianId: 'clin-demo',
          name: 'Nomsa Demo',
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        clinicianId: clinician.id,
        name: clinician.displayName ?? 'Clinician',
        clinician,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('/api/me error', err);
    // Safe fallback so UI still renders
    return NextResponse.json(
      {
        ok: false,
        clinicianId: 'clin-demo',
        name: 'Nomsa Demo',
        error: String(err),
      },
      { status: 200 },
    );
  }
}
