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
import {
  bestEffortDeleteTrainingResourceObject,
  presignTrainingResourceAccess,
  presignTrainingResourceUpload,
  trainingResourceObjectBelongsTo,
  trainingResourceObjectKey,
  trainingResourceStorageResponse,
  validateTrainingResourceUploadInput,
  verifyTrainingResourceUpload,
} from '@/src/clinicians/onboarding/training-resource-storage';

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


export async function POST(
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
        .catch(
          () =>
            ({} as any),
        );

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

    const resourceId =
      cleanId(
        body?.resourceId,
      );

    const versionId =
      cleanId(
        body?.versionId,
      );

    if (
      !resourceId ||
      !versionId
    ) {
      return json(
        {
          ok: false,
          error:
            'training_resource_identity_required',
        },
        400,
      );
    }

    if (
      action ===
      'presign_upload'
    ) {
      const settings =
        await readSettings(
          prisma,
        );

      if (!settings) {
        return json(
          {
            ok: false,
            error:
              'training_policy_settings_missing',
          },
          409,
        );
      }

      const library =
        readTrainingResourceLibrary(
          settings.trainingPolicy,
        );

      const resource =
        library.resources.find(
          (item) =>
            item.id ===
            resourceId,
        );

      if (!resource) {
        return json(
          {
            ok: false,
            error:
              'training_resource_not_found',
          },
          404,
        );
      }

      const version =
        resource.versions.find(
          (item) =>
            item.id ===
            versionId,
        );

      if (!version) {
        return json(
          {
            ok: false,
            error:
              'training_resource_version_not_found',
          },
          404,
        );
      }

      const upload =
        validateTrainingResourceUploadInput({
          fileName:
            body?.fileName,
          contentType:
            body?.contentType,
          sizeBytes:
            body?.sizeBytes,
          checksumSha256:
            body?.checksumSha256,
        });

      const objectKey =
        trainingResourceObjectKey({
          resourceId,
          versionId,
        });

      const signed =
        await presignTrainingResourceUpload({
          objectKey,
          contentType:
            upload.contentType,
          checksumSha256:
            upload.checksumSha256,
        });

      return json({
        ok: true,
        source:
          'admin_training_resource_upload',
        resourceId,
        versionId,
        objectKey,
        fileName:
          upload.fileName,
        contentType:
          upload.contentType,
        sizeBytes:
          upload.sizeBytes,
        ...signed,
      });
    }

    if (
      action ===
      'confirm_upload'
    ) {
      const objectKey =
        String(
          body?.objectKey ||
          '',
        )
          .trim()
          .slice(
            0,
            1000,
          );

      if (
        !trainingResourceObjectBelongsTo({
          objectKey,
          resourceId,
          versionId,
        })
      ) {
        return json(
          {
            ok: false,
            error:
              'training_resource_object_invalid',
          },
          400,
        );
      }

      const upload =
        validateTrainingResourceUploadInput({
          fileName:
            body?.fileName,
          contentType:
            body?.contentType,
          sizeBytes:
            body?.sizeBytes,
          checksumSha256:
            body?.checksumSha256,
        });

      await verifyTrainingResourceUpload({
        objectKey,
        contentType:
          upload.contentType,
        sizeBytes:
          upload.sizeBytes,
        checksumSha256:
          upload.checksumSha256,
      });

      let result:
        | {
            kind:
              'OK';
            library: ReturnType<
              typeof readTrainingResourceLibrary
            >;
            previousFileKey:
              string | null;
          }
        | {
            kind:
              'SETTINGS_MISSING' |
              'RESOURCE_NOT_FOUND' |
              'VERSION_NOT_FOUND';
          };

      try {
        result =
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

              const library =
                readTrainingResourceLibrary(
                  settings.trainingPolicy,
                );

              const resource =
                library.resources.find(
                  (item) =>
                    item.id ===
                    resourceId,
                );

              if (!resource) {
                return {
                  kind:
                    'RESOURCE_NOT_FOUND' as const,
                };
              }

              const version =
                resource.versions.find(
                  (item) =>
                    item.id ===
                    versionId,
                );

              if (!version) {
                return {
                  kind:
                    'VERSION_NOT_FOUND' as const,
                };
              }

              const previousFileKey =
                version.fileKey ||
                null;

              const nextLibrary =
                normaliseTrainingResourceLibrary({
                  ...library,
                  resources:
                    library.resources.map(
                      (item) =>
                        item.id ===
                        resourceId
                          ? {
                              ...item,
                              versions:
                                item.versions.map(
                                  (
                                    candidate,
                                  ) =>
                                    candidate.id ===
                                    versionId
                                      ? {
                                          ...candidate,
                                          url:
                                            null,
                                          fileKey:
                                            objectKey,
                                          fileName:
                                            upload.fileName,
                                          mimeType:
                                            upload.contentType,
                                          sizeBytes:
                                            upload.sizeBytes,
                                          checksumSha256:
                                            upload.checksumSha256,
                                          uploadedBy:
                                            actorId ||
                                            'admin',
                                        }
                                      : candidate,
                                ),
                            }
                          : item,
                    ),
                });

              const nextPolicy =
                writeTrainingResourceLibrary(
                  settings.trainingPolicy,
                  nextLibrary,
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
                      actorId ||
                      'admin',
                  },
                });

              return {
                kind:
                  'OK' as const,
                library:
                  readTrainingResourceLibrary(
                    nextPolicy,
                  ),
                previousFileKey,
              };
            },
          );
      } catch (
        error
      ) {
        await bestEffortDeleteTrainingResourceObject(
          objectKey,
        );

        throw error;
      }

      if (
        result.kind !==
        'OK'
      ) {
        await bestEffortDeleteTrainingResourceObject(
          objectKey,
        );

        const status =
          result.kind ===
          'SETTINGS_MISSING'
            ? 409
            : 404;

        const error =
          result.kind ===
          'SETTINGS_MISSING'
            ? 'training_policy_settings_missing'
            : result.kind ===
                'RESOURCE_NOT_FOUND'
              ? 'training_resource_not_found'
              : 'training_resource_version_not_found';

        return json(
          {
            ok: false,
            error,
          },
          status,
        );
      }

      if (
        result.previousFileKey &&
        result.previousFileKey !==
          objectKey &&
        trainingResourceObjectBelongsTo({
          objectKey:
            result.previousFileKey,
          resourceId,
          versionId,
        })
      ) {
        await bestEffortDeleteTrainingResourceObject(
          result.previousFileKey,
        );
      }

      await writeAudit(
        request,
        {
          actorId,
          action:
            'training_resource_file.uploaded',
          entityType:
            'TrainingResource',
          entityId:
            resourceId,
          description:
            'Admin uploaded and verified a native training resource file',
          meta: {
            versionId,
            fileName:
              upload.fileName,
            contentType:
              upload.contentType,
            sizeBytes:
              upload.sizeBytes,
            checksumSha256:
              upload.checksumSha256,
          },
        },
      );

      return json({
        ok: true,
        source:
          'admin_training_resource_upload',
        resourceId,
        versionId,
        library:
          result.library,
      });
    }

    if (
      action ===
      'access_file'
    ) {
      const settings =
        await readSettings(
          prisma,
        );

      if (!settings) {
        return json(
          {
            ok: false,
            error:
              'training_policy_settings_missing',
          },
          409,
        );
      }

      const library =
        readTrainingResourceLibrary(
          settings.trainingPolicy,
        );

      const resource =
        library.resources.find(
          (item) =>
            item.id ===
            resourceId,
        );

      if (!resource) {
        return json(
          {
            ok: false,
            error:
              'training_resource_not_found',
          },
          404,
        );
      }

      const version =
        resource.versions.find(
          (item) =>
            item.id ===
            versionId,
        );

      if (
        !version ||
        !version.fileKey
      ) {
        return json(
          {
            ok: false,
            error:
              'training_resource_file_not_found',
          },
          404,
        );
      }

      if (
        !trainingResourceObjectBelongsTo({
          objectKey:
            version.fileKey,
          resourceId,
          versionId,
        })
      ) {
        return json(
          {
            ok: false,
            error:
              'training_resource_object_invalid',
          },
          409,
        );
      }

      const upload =
        validateTrainingResourceUploadInput({
          fileName:
            version.fileName,
          contentType:
            version.mimeType,
          sizeBytes:
            version.sizeBytes,
          checksumSha256:
            version.checksumSha256,
        });

      const disposition =
        String(
          body?.disposition ||
          '',
        )
          .trim()
          .toLowerCase() ===
        'attachment'
          ? 'attachment'
          : 'inline';

      const signed =
        await presignTrainingResourceAccess({
          objectKey:
            version.fileKey,
          fileName:
            upload.fileName,
          contentType:
            upload.contentType,
          disposition,
        });

      await writeAudit(
        request,
        {
          actorId,
          action:
            disposition ===
            'attachment'
              ? 'training_resource_file.downloaded'
              : 'training_resource_file.viewed',
          entityType:
            'TrainingResource',
          entityId:
            resourceId,
          description:
            disposition ===
            'attachment'
              ? 'Admin requested a secure training resource download'
              : 'Admin requested a secure training resource view',
          meta: {
            versionId,
            disposition,
          },
        },
      );

      return json({
        ok: true,
        source:
          'admin_training_resource_access',
        resourceId,
        versionId,
        fileName:
          upload.fileName,
        mimeType:
          upload.contentType,
        ...signed,
      });
    }

    return json(
      {
        ok: false,
        error:
          'training_resource_action_invalid',
      },
      400,
    );
  } catch (
    error: any
  ) {
    const storage =
      trainingResourceStorageResponse(
        error,
      );

    if (storage) {
      return json(
        storage.body,
        storage.status,
      );
    }

    console.error(
      '[admin-training-materials][POST] error',
      error,
    );

    const status =
      Number(
        error?.status,
      );

    return json(
      {
        ok: false,
        error:
          error?.code ||
          error?.message ||
          'training_resource_action_failed',
      },
      Number.isFinite(
        status,
      ) &&
      status >= 400 &&
      status <= 599
        ? status
        : 500,
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
