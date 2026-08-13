// apps/api-gateway/app/api/admin/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import {
  readProgrammeTrainingMaterials,
  writeProgrammeTrainingMaterials,
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

function cleanId(
  value: unknown,
) {
  const id =
    String(value ?? '')
      .trim();

  return id.length <= 160
    ? id
    : id.slice(0, 160);
}

async function requireTrainingSlot(
  db: any,
  trainingSlotId: string,
) {
  return db
    .clinicianTrainingSlot
    .findUnique({
      where: {
        id: trainingSlotId,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
}

export async function GET(
  request: NextRequest,
) {
  try {
    const admin =
      await verifyAdminRequest(
        request,
      );

    if (!admin.ok) {
      return admin.response;
    }

    const trainingSlotId =
      cleanId(
        request.nextUrl
          .searchParams
          .get('trainingSlotId'),
      );

    if (!trainingSlotId) {
      return json(
        {
          ok: false,
          error:
            'trainingSlotId_required',
        },
        400,
      );
    }

    const slot =
      await requireTrainingSlot(
        prisma,
        trainingSlotId,
      );

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

    const settings =
      await prisma
        .clinicianOnboardingSetting
        .findUnique({
          where: {
            id: 'default',
          },
          select: {
            trainingPolicy: true,
          },
        });

    const materials =
      readProgrammeTrainingMaterials(
        settings?.trainingPolicy,
        trainingSlotId,
        {
          includeInactive: true,
        },
      );

    return json({
      ok: true,
      trainingSlot: slot,
      materials,
      items: materials,
    });
  } catch (error: any) {
    console.error(
      '[admin-training-materials][GET] error',
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

export async function PATCH(
  request: NextRequest,
) {
  try {
    const admin =
      await verifyAdminRequest(
        request,
      );

    if (!admin.ok) {
      return admin.response;
    }

    const body =
      await request
        .json()
        .catch(() => ({} as any));

    const trainingSlotId =
      cleanId(
        body?.trainingSlotId ||
        body?.slotId,
      );

    if (!trainingSlotId) {
      return json(
        {
          ok: false,
          error:
            'trainingSlotId_required',
        },
        400,
      );
    }

    if (!Array.isArray(body?.materials)) {
      return json(
        {
          ok: false,
          error:
            'training_materials_array_required',
        },
        400,
      );
    }

    const actorId =
      cleanId(
        (admin as any).uid ||
        (admin as any).userId ||
        'admin',
      );

    const result =
      await prisma.$transaction(
        async (tx: any) => {
          const slot =
            await requireTrainingSlot(
              tx,
              trainingSlotId,
            );

          if (!slot) {
            return {
              kind:
                'NOT_FOUND' as const,
            };
          }

          const settings =
            await tx
              .clinicianOnboardingSetting
              .findUnique({
                where: {
                  id: 'default',
                },
                select: {
                  trainingPolicy:
                    true,
                },
              });

          if (!settings) {
            return {
              kind:
                'SETTINGS_MISSING' as const,
            };
          }

          const nextPolicy =
            writeProgrammeTrainingMaterials(
              settings.trainingPolicy,
              trainingSlotId,
              body.materials,
            );

          await tx
            .clinicianOnboardingSetting
            .update({
              where: {
                id: 'default',
              },
              data: {
                trainingPolicy:
                  nextPolicy as unknown as
                    Prisma.InputJsonValue,
                updatedByUserId:
                  actorId || 'admin',
              },
            });

          const materials =
            readProgrammeTrainingMaterials(
              nextPolicy,
              trainingSlotId,
              {
                includeInactive: true,
              },
            );

          return {
            kind: 'OK' as const,
            slot,
            materials,
          };
        },
      );

    if (
      result.kind ===
      'NOT_FOUND'
    ) {
      return json(
        {
          ok: false,
          error:
            'training_slot_not_found',
        },
        404,
      );
    }

    if (
      result.kind ===
      'SETTINGS_MISSING'
    ) {
      return json(
        {
          ok: false,
          error:
            'training_policy_settings_missing',
        },
        409,
      );
    }

    await prisma.auditLog
      .create({
        data: {
          actorUserId:
            actorId || null,
          actorType: 'ADMIN',
          actorRefId:
            actorId || null,
          app: 'admin-dashboard',
          action:
            'clinician_training_materials.updated',
          entityType:
            'ClinicianTrainingSlot',
          entityId:
            trainingSlotId,
          description:
            'Admin updated programme training materials',
          ip:
            request.headers
              .get(
                'x-forwarded-for',
              )
              ?.split(',')[0]
              ?.trim() ||
            request.headers.get(
              'x-real-ip',
            ) ||
            null,
          userAgent:
            request.headers.get(
              'user-agent',
            ),
          meta: {
            materialCount:
              result.materials.length,
            activeMaterialCount:
              result.materials.filter(
                (item) =>
                  item.active,
              ).length,
          },
        },
      })
      .catch((error) => {
        console.warn(
          '[admin-training-materials] audit failed',
          error,
        );
      });

    return json({
      ok: true,
      trainingSlot:
        result.slot,
      materials:
        result.materials,
      items:
        result.materials,
    });
  } catch (error: any) {
    console.error(
      '[admin-training-materials][PATCH] error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_materials_update_failed',
      },
      500,
    );
  }
}
