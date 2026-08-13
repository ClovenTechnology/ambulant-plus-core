// apps/api-gateway/app/api/clinicians/me/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  readProgrammeTrainingMaterials,
} from '@/src/clinicians/onboarding/training-materials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control':
          'no-store, max-age=0',
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const requestedClinicianId =
      request.nextUrl
        .searchParams
        .get('clinicianId');

    const identity =
      await resolveAuthenticatedClinician(
        request,
        requestedClinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const clinicianId =
      String(
        identity.clinician.id,
      );

    const onboarding =
      await prisma
        .clinicianOnboarding
        .findFirst({
          where: {
            clinicianId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            trainingSlotId: true,
          },
        });

    const trainingSlotId =
      String(
        onboarding
          ?.trainingSlotId ||
        '',
      ).trim();

    if (!trainingSlotId) {
      return json({
        ok: true,
        source:
          'admin_configured',
        trainingSlotId: null,
        items: [],
        materials: [],
      });
    }

    const [
      slot,
      settings,
    ] =
      await Promise.all([
        prisma
          .clinicianTrainingSlot
          .findUnique({
            where: {
              id:
                trainingSlotId,
            },
            select: {
              id: true,
              title: true,
              status: true,
            },
          }),
        prisma
          .clinicianOnboardingSetting
          .findUnique({
            where: {
              id: 'default',
            },
            select: {
              trainingPolicy:
                true,
            },
          }),
      ]);

    if (!slot) {
      return json(
        {
          ok: false,
          error:
            'training_slot_not_found',
        },
        404,
      );
    }

    const materials =
      readProgrammeTrainingMaterials(
        settings?.trainingPolicy,
        trainingSlotId,
        {
          includeInactive: false,
        },
      );

    return json({
      ok: true,
      source:
        'admin_configured',
      trainingSlotId,
      trainingSlot: slot,
      items: materials,
      materials,
    });
  } catch (error: any) {
    console.error(
      '[clinician-training-materials] error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_materials_fetch_failed',
      },
      500,
    );
  }
}
