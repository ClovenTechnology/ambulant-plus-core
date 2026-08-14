// apps/api-gateway/app/api/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  verifyTrainingAdmissionToken,
} from '@/src/clinicians/onboarding/training-admission';
import {
  flattenResolvedTrainingContent,
  normaliseTrainingSessionRefs,
  resolveProgrammeTrainingContent,
  TrainingContentAudience,
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

function clean(
  value: unknown,
  max = 320,
) {
  return String(
    value ?? '',
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function clinicianDisplayName(
  clinician: any,
) {
  const composed = [
    clean(
      clinician?.firstName,
      120,
    ),
    clean(
      clinician?.lastName,
      120,
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    clean(
      clinician?.fullName,
      240,
    ) ||
    clean(
      clinician?.name,
      240,
    ) ||
    clean(
      clinician?.displayName,
      240,
    ) ||
    composed ||
    clean(
      clinician?.email,
      240,
    ) ||
    'Clinician'
  );
}

function canonicalAudience(
  role: unknown,
): TrainingContentAudience {
  const value =
    String(
      role ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    value === 'patient' ||
    value === 'trainer' ||
    value === 'observer' ||
    value === 'admin'
  ) {
    return value;
  }

  return 'clinician';
}

export async function GET(
  request: NextRequest,
) {
  try {
    const joinToken =
      clean(
        request.headers.get(
          'x-join-token',
        ),
        12000,
      );

    const requestedSlotId =
      clean(
        request.nextUrl
          .searchParams
          .get('trainingSlotId'),
        160,
      );

    const expectedRoomId =
      clean(
        request.nextUrl
          .searchParams
          .get('roomId'),
        240,
      );

    let trainingSlotId =
      requestedSlotId;

    let audience:
      TrainingContentAudience =
        'clinician';

    let identity: {
      subjectId: string;
      uid: string;
      displayName: string;
    } = {
      subjectId: '',
      uid: '',
      displayName:
        'Training participant',
    };

    if (joinToken) {
      const admission =
        await verifyTrainingAdmissionToken(
          joinToken,
          expectedRoomId ||
            null,
        );

      trainingSlotId =
        String(
          admission.trainingSlotId,
        );

      if (
        requestedSlotId &&
        requestedSlotId !==
          trainingSlotId
      ) {
        return json(
          {
            ok: false,
            error:
              'training_slot_admission_mismatch',
          },
          403,
        );
      }

      audience =
        canonicalAudience(
          admission.role,
        );

      identity = {
        subjectId:
          String(
            admission.subjectId,
          ),
        uid:
          String(
            admission.uid,
          ),
        displayName:
          String(
            admission.displayName ||
            admission.uid ||
            audience,
          ),
      };
    } else {
      const requestedClinicianId =
        request.nextUrl
          .searchParams
          .get('clinicianId');

      const authenticated =
        await resolveAuthenticatedClinician(
          request,
          requestedClinicianId,
        );

      if (!authenticated.ok) {
        return authenticated.response;
      }

      const clinician: any =
        authenticated.clinician;

      const onboarding =
        await prisma
          .clinicianOnboarding
          .findFirst({
            where: {
              clinicianId:
                String(
                  clinician.id,
                ),
            },
            orderBy: {
              createdAt:
                'desc',
            },
            select: {
              trainingSlotId:
                true,
            },
          });

      const bookedSlotId =
        clean(
          onboarding
            ?.trainingSlotId,
          160,
        );

      if (!bookedSlotId) {
        return json({
          ok: true,
          source:
            'admin_configured',
          role:
            'clinician',
          identity: {
            subjectId:
              String(
                clinician.id,
              ),
            uid:
              String(
                clinician.userId ||
                clinician.id,
              ),
            displayName:
              clinicianDisplayName(
                clinician,
              ),
          },
          trainingSlotId:
            null,
          sessions: [],
          modules: [],
          items: [],
          materials: [],
        });
      }

      if (
        requestedSlotId &&
        requestedSlotId !==
          bookedSlotId
      ) {
        return json(
          {
            ok: false,
            error:
              'training_slot_booking_mismatch',
          },
          403,
        );
      }

      trainingSlotId =
        bookedSlotId;

      audience =
        'clinician';

      identity = {
        subjectId:
          String(
            clinician.id,
          ),
        uid:
          String(
            clinician.userId ||
            clinician.id,
          ),
        displayName:
          clinicianDisplayName(
            clinician,
          ),
      };
    }

    if (!trainingSlotId) {
      return json({
        ok: true,
        source:
          'admin_configured',
        role:
          audience,
        identity,
        trainingSlotId:
          null,
        sessions: [],
        modules: [],
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
              sessions: true,
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

    const sessions =
      normaliseTrainingSessionRefs(
        slot.sessions,
      );

    const resolved =
      resolveProgrammeTrainingContent(
        settings?.trainingPolicy,
        trainingSlotId,
        audience,
        {
          includeDraft: false,
          includeLegacy: true,
        },
      );

    const items =
      flattenResolvedTrainingContent(
        resolved,
      );

    return json({
      ok: true,
      source:
        'admin_configured',
      role:
        audience,
      identity,
      trainingSlotId,
      trainingSlot: {
        id:
          slot.id,
        title:
          slot.title,
        status:
          slot.status,
      },
      sessions,
      modules:
        resolved.modules,
      legacyMaterials:
        resolved.legacy,
      items,
      materials:
        items,
    });
  } catch (error: any) {
    console.error(
      '[training-materials][GET] error',
      error,
    );

    const code =
      String(
        error?.code ||
        error?.message ||
        '',
      );

    const status =
      Number(
        error?.status,
      );

    return json(
      {
        ok: false,
        error:
          code ||
          'training_materials_fetch_failed',
      },
      Number.isFinite(status) &&
      status >= 400 &&
      status <= 599
        ? status
        : 500,
    );
  }
}
