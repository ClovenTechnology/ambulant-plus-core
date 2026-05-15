// apps/clinician-app/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function normaliseEmail(value: string | null) {
  return String(value || '').trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const email =
      normaliseEmail(req.headers.get('x-clinician-email')) ||
      normaliseEmail(req.headers.get('x-user-email'));

    const clinicianId =
      req.headers.get('x-clinician-id') ||
      req.headers.get('x-user-id') ||
      '';

    if (!email && !clinicianId) {
      return json(
        {
          ok: false,
          error:
            'Unauthenticated clinician request. Missing clinician identity.',
        },
        401
      );
    }

    const clinician = await prisma.clinicianProfile.findFirst({
      where: clinicianId
        ? { id: clinicianId }
        : {
            OR: [{ userId: email }, { email }],
          } as any,
    });

    if (!clinician) {
      return json(
        {
          ok: false,
          error: 'Clinician profile not found.',
        },
        404
      );
    }

    return json({
      ok: true,
      clinicianId: clinician.id,
      name: clinician.displayName ?? 'Clinician',
      clinician,
    });
  } catch (err: any) {
    console.error('/api/me error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'Unable to resolve clinician profile.',
      },
      500
    );
  }
}