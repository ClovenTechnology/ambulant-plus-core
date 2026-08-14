// apps/api-gateway/app/api/admin/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import {
  flattenResolvedTrainingContent,
  normaliseTrainingResourceLibrary,
  normaliseTrainingSessionRefs,
  readProgrammeModuleAssignments,
  readProgrammeTrainingMaterials,
  readTrainingResourceLibrary,
  resolveProgrammeTrainingContent,
  TrainingContentAudience,
  writeProgrammeModuleAssignments,
  writeProgrammeTrainingMaterials,
  writeTrainingResourceLibrary,
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

function previewAudience(
  value: unknown,
): TrainingContentAudience {
  const audience =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    audience === 'clinician' ||
    audience === 'patient' ||
    audience === 'trainer' ||
    audience === 'observer' ||
    audience === 'admin' ||
    audience === 'assessor'
  ) {
    return audience;
  }

  return 'clinician';
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
        sessions: true,
      },
    });
}

async function readSettings(
  db: any,
) {
  return db
    .clinicianOnboardingSetting
    .findUnique({
      where: {
        id: 'default',
      },
      select: {
        trainingPolicy: true,
      },
    });
}

function actorIdFromAdmin(
  admin: any,
) {
  return cleanId(
    admin?.uid ||
    admin?.userId ||
    'admin',
  );
}

async function writeAudit(
  request: NextRequest,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    description: string;
    meta?: Record<string, any>;
  },
) {
  await prisma.auditLog
    .create({
      data: {
        actorUserId:
          input.actorId ||
          null,
        actorType: 'ADMIN',
        actorRefId:
          input.actorId ||
          null,
        app: 'admin-dashboard',
        action:
          input.action,
        entityType:
          input.entityType,
        entityId:
          input.entityId,
        description:
          input.description,
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
        meta:
          input.meta || {},
      },
    })
    .catch((error) => {
      console.warn(
        '[admin-training-materials] audit failed',
        error,
      );
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

    const settings =
      await readSettings(
        prisma,
      );

    const library =
      readTrainingResourceLibrary(
        settings?.trainingPolicy,
      );

    if (!trainingSlotId) {
      return json({
        ok: true,
        source:
          'admin_training_resource_library',
        library,
      });
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

    const sessions =
      normaliseTrainingSessionRefs(
        slot.sessions,
      );

    const materials =
      readProgrammeTrainingMaterials(
        settings?.trainingPolicy,
        trainingSlotId,
        {
          includeInactive: true,
        },
      );

    const assignments =
      readProgrammeModuleAssignments(
        settings?.trainingPolicy,
        trainingSlotId,
      );

    const audience =
      previewAudience(
        request.nextUrl
          .searchParams
          .get('previewRole'),
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

    return json({
      ok: true,
      source:
        'admin_training_content',
      trainingSlot: {
        id:
          slot.id,
        title:
          slot.title,
        status:
          slot.status,
        sessions,
      },
      library,
      assignments,
      preview: {
        audience,
        modules:
          resolved.modules,
        items:
          flattenResolvedTrainingContent(
            resolved,
          ),
      },
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

    const action =
      String(
        body?.action ||
        '',
      )
        .trim()
        .toLowerCase();

    const actorId =
      actorIdFromAdmin(
        admin,
      );

    if (
      action ===
      'save_library'
    ) {
      const library =
        normaliseTrainingResourceLibrary(
          body?.library,
        );

      const result =
        await prisma.$transaction(
          async (tx: any) => {
            const settings =
              await readSettings(
                tx,
              );

            if (!settings) {
              return {
                kind:
                  'SETTINGS_MISSING' as const,
              };
            }

            const nextPolicy =
              writeTrainingResourceLibrary(
                settings.trainingPolicy,
                library,
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

            return {
              kind: 'OK' as const,
              library:
                readTrainingResourceLibrary(
                  nextPolicy,
                ),
            };
          },
        );

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

      await writeAudit(
        request,
        {
          actorId,
          action:
            'training_resource_library.updated',
          entityType:
            'TrainingResourceLibrary',
          entityId:
            'default',
          description:
            'Admin updated the reusable training resource library',
          meta: {
            resourceCount:
              result.library.resources.length,
            moduleCount:
              result.library.modules.length,
          },
        },
      );

      return json({
        ok: true,
        source:
          'admin_training_resource_library',
        library:
          result.library,
      });
    }

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

    if (
      action ===
      'save_programme_content'
    ) {
      if (
        !Array.isArray(
          body?.assignments,
        )
      ) {
        return json(
          {
            ok: false,
            error:
              'training_assignments_array_required',
          },
          400,
        );
      }

      const result =
        await prisma.$transaction(
          async (tx: any) => {
            const [
              slot,
              settings,
            ] =
              await Promise.all([
                requireTrainingSlot(
                  tx,
                  trainingSlotId,
                ),
                readSettings(
                  tx,
                ),
              ]);

            if (!slot) {
              return {
                kind:
                  'NOT_FOUND' as const,
              };
            }

            if (!settings) {
              return {
                kind:
                  'SETTINGS_MISSING' as const,
              };
            }

            const library =
              readTrainingResourceLibrary(
                settings.trainingPolicy,
              );

            const knownModuleIds =
              new Set(
                library.modules.map(
                  (module) =>
                    module.id,
                ),
              );

            const sessions =
              normaliseTrainingSessionRefs(
                slot.sessions,
              );

            const allowedSessionIds =
              new Set(
                sessions.map(
                  (session) =>
                    session.id,
                ),
              );

            const nextPolicy =
              writeProgrammeModuleAssignments(
                settings.trainingPolicy,
                trainingSlotId,
                body.assignments,
                {
                  knownModuleIds,
                  allowedSessionIds,
                },
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

            const assignments =
              readProgrammeModuleAssignments(
                nextPolicy,
                trainingSlotId,
              );

            return {
              kind: 'OK' as const,
              slot,
              sessions,
              library,
              assignments,
              policy:
                nextPolicy,
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

      const audience =
        previewAudience(
          body?.previewRole,
        );

      const resolved =
        resolveProgrammeTrainingContent(
          result.policy,
          trainingSlotId,
          audience,
          {
            includeDraft: false,
            includeLegacy: true,
          },
        );

      await writeAudit(
        request,
        {
          actorId,
          action:
            'training_programme_content.updated',
          entityType:
            'ClinicianTrainingSlot',
          entityId:
            trainingSlotId,
          description:
            'Admin updated reusable module assignments for a training programme',
          meta: {
            assignmentCount:
              result.assignments.length,
            programmeWideCount:
              result.assignments.filter(
                (assignment) =>
                  assignment.scope ===
                  'programme',
              ).length,
            sessionScopedCount:
              result.assignments.filter(
                (assignment) =>
                  assignment.scope ===
                  'sessions',
              ).length,
          },
        },
      );

      return json({
        ok: true,
        source:
          'admin_training_content',
        trainingSlot: {
          id:
            result.slot.id,
          title:
            result.slot.title,
          status:
            result.slot.status,
          sessions:
            result.sessions,
        },
        library:
          result.library,
        assignments:
          result.assignments,
        preview: {
          audience,
          modules:
            resolved.modules,
          items:
            flattenResolvedTrainingContent(
              resolved,
            ),
        },
      });
    }

    /*
     * Backwards-compatible P0 programme-only material endpoint.
     * Keep this branch while existing published content is migrated
     * into reusable modules.
     */
    if (
      !Array.isArray(
        body?.materials,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            'training_materials_array_required',
        },
        400,
      );
    }

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
            await readSettings(
              tx,
            );

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

    await writeAudit(
      request,
      {
        actorId,
        action:
          'clinician_training_materials.updated',
        entityType:
          'ClinicianTrainingSlot',
        entityId:
          trainingSlotId,
        description:
          'Admin updated legacy programme-only training materials',
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
    );

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
