// apps/api-gateway/app/api/admin/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
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


type TrainingLibraryEntityType =
  | 'resource'
  | 'module';

function purgeEntityType(
  value: unknown,
): TrainingLibraryEntityType | null {
  const entityType =
    String(value || '')
      .trim()
      .toLowerCase();

  return (
    entityType === 'resource' ||
    entityType === 'module'
  )
    ? entityType
    : null;
}

async function trainingLibraryPurgeImpact(
  db: any,
  trainingPolicy: unknown,
  entityType: TrainingLibraryEntityType,
  entityId: string,
) {
  const library =
    readTrainingResourceLibrary(
      trainingPolicy,
    );

  const resource =
    entityType === 'resource'
      ? library.resources.find(
          (item) =>
            item.id === entityId,
        ) || null
      : null;

  const module =
    entityType === 'module'
      ? library.modules.find(
          (item) =>
            item.id === entityId,
        ) || null
      : null;

  if (
    entityType === 'resource' &&
    !resource
  ) {
    return {
      kind:
        'NOT_FOUND' as const,
    };
  }

  if (
    entityType === 'module' &&
    !module
  ) {
    return {
      kind:
        'NOT_FOUND' as const,
    };
  }

  const moduleIds =
    entityType === 'module'
      ? [entityId]
      : library.modules
          .filter(
            (item) =>
              item.resourceIds.includes(
                entityId,
              ),
          )
          .map(
            (item) =>
              item.id,
          );

  const moduleIdSet =
    new Set(
      moduleIds,
    );

  const slots =
    moduleIds.length
      ? await db
          .clinicianTrainingSlot
          .findMany({
            select: {
              id: true,
              title: true,
              status: true,
            },
          })
      : [];

  const programmeReferences: Array<{
    trainingSlotId: string;
    title: string;
    status: string;
    assignmentId: string;
    moduleId: string;
    assignmentStatus: string;
  }> =
    slots.flatMap(
      (slot: any) =>
        readProgrammeModuleAssignments(
          trainingPolicy,
          slot.id,
        )
          .filter(
            (assignment) =>
              moduleIdSet.has(
                assignment.moduleId,
              ),
          )
          .map(
            (assignment) => ({
              trainingSlotId:
                slot.id,
              title:
                slot.title,
              status:
                slot.status,
              assignmentId:
                assignment.id,
              moduleId:
                assignment.moduleId,
              assignmentStatus:
                assignment.status,
            }),
          ),
    );

  const referencedSlotIds =
    Array.from(
      new Set(
        programmeReferences.map(
          (reference) =>
            reference.trainingSlotId,
        ),
      ),
    );

  const historyRows =
    referencedSlotIds.length
      ? await db
          .clinicianTrainingSlot
          .findMany({
            where: {
              id: {
                in:
                  referencedSlotIds,
              },
            },
            select: {
              id: true,
              title: true,
              status: true,
              _count: {
                select: {
                  onboardings: true,
                  participantAssignments:
                    true,
                  admissions: true,
                  attendanceSessions:
                    true,
                },
              },
            },
          })
      : [];

  const blockers =
    historyRows
      .filter(
        (row: any) =>
          Number(
            row?._count
              ?.onboardings ||
            0,
          ) > 0 ||
          Number(
            row?._count
              ?.participantAssignments ||
            0,
          ) > 0 ||
          Number(
            row?._count
              ?.admissions ||
            0,
          ) > 0 ||
          Number(
            row?._count
              ?.attendanceSessions ||
            0,
          ) > 0,
      )
      .map(
        (row: any) =>
          `Protected training history exists for "${String(row.title || row.id)}" (onboarding ${Number(row?._count?.onboardings || 0)}, participants ${Number(row?._count?.participantAssignments || 0)}, admissions ${Number(row?._count?.admissions || 0)}, attendance ${Number(row?._count?.attendanceSessions || 0)}).`,
      );

  const objectKeys =
    resource
      ? Array.from(
          new Set(
            resource.versions
              .map(
                (version) =>
                  String(
                    version.fileKey ||
                    '',
                  ).trim(),
              )
              .filter(Boolean),
          ),
        )
      : [];

  return {
    kind: 'OK' as const,
    entityType,
    entityId,
    title:
      resource?.title ||
      module?.title ||
      entityId,
    status:
      resource?.status ||
      module?.status ||
      'unknown',
    moduleMemberships:
      entityType ===
      'resource'
        ? library.modules
            .filter(
              (item) =>
                item.resourceIds.includes(
                  entityId,
                ),
            )
            .map(
              (item) => ({
                id:
                  item.id,
                title:
                  item.title,
                status:
                  item.status,
              }),
            )
        : [],
    moduleIds,
    programmeReferences,
    referencedSlotIds,
    historyRows,
    blockers,
    objectKeys,
    canPurge:
      blockers.length === 0,
    library,
  };
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
        'preview_purge' ||
      action ===
        'purge_library_entity'
    ) {
      let humanAdmin: Awaited<
        ReturnType<
          typeof requireAdminStaffActor
        >
      >;

      try {
        humanAdmin =
          await requireAdminStaffActor(
            request,
          );
      } catch (error) {
        const handled =
          adminStaffAuthResponse(
            error,
          );

        if (handled) {
          return json(
            handled.body,
            handled.status,
          );
        }

        throw error;
      }

      if (
        !humanAdmin.isSuperAdmin
      ) {
        return json(
          {
            ok: false,
            error:
              'super_admin_required',
          },
          403,
        );
      }

      const entityType =
        purgeEntityType(
          body?.entityType,
        );

      const entityId =
        cleanId(
          body?.entityId,
        );

      if (
        !entityType ||
        !entityId
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_entity_required',
          },
          400,
        );
      }

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

      const preview =
        await trainingLibraryPurgeImpact(
          prisma,
          settings.trainingPolicy,
          entityType,
          entityId,
        );

      if (
        preview.kind ===
        'NOT_FOUND'
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_entity_not_found',
          },
          404,
        );
      }

      if (
        action ===
        'preview_purge'
      ) {
        await writeAudit(
          request,
          {
            actorId:
              humanAdmin.userId,
            action:
              'training_resource_library.purge_previewed',
            entityType:
              entityType ===
              'resource'
                ? 'TrainingResource'
                : 'TrainingModule',
            entityId,
            description:
              'SUPER_ADMIN previewed permanent training-content purge dependencies',
            meta: {
              canPurge:
                preview.canPurge,
              blockerCount:
                preview.blockers.length,
              programmeReferenceCount:
                preview.programmeReferences.length,
              moduleMembershipCount:
                preview.moduleMemberships.length,
            },
          },
        );

        return json({
          ok: true,
          source:
            'admin_training_resource_library_purge_preview',
          preview: {
            entityType,
            entityId,
            title:
              preview.title,
            status:
              preview.status,
            canPurge:
              preview.canPurge,
            blockers:
              preview.blockers,
            programmeReferenceCount:
              preview.programmeReferences.length,
            moduleMembershipCount:
              preview.moduleMemberships.length,
            programmeReferences:
              preview.programmeReferences,
            moduleMemberships:
              preview.moduleMemberships,
          },
        });
      }

      const expectedConfirmation =
        `PURGE:${entityType}:${entityId}`;

      if (
        String(
          body?.confirmation ||
          '',
        ).trim() !==
        expectedConfirmation
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_purge_confirmation_required',
          },
          400,
        );
      }

      const result =
        await prisma.$transaction(
          async (tx: any) => {
            const currentSettings =
              await readSettings(
                tx,
              );

            if (!currentSettings) {
              return {
                kind:
                  'SETTINGS_MISSING' as const,
              };
            }

            const impact =
              await trainingLibraryPurgeImpact(
                tx,
                currentSettings.trainingPolicy,
                entityType,
                entityId,
              );

            if (
              impact.kind ===
              'NOT_FOUND'
            ) {
              return {
                kind:
                  'NOT_FOUND' as const,
              };
            }

            if (
              !impact.canPurge
            ) {
              return {
                kind:
                  'PROTECTED_HISTORY' as const,
                blockers:
                  impact.blockers,
              };
            }

            let nextPolicy =
              currentSettings.trainingPolicy;

            if (
              entityType ===
              'resource'
            ) {
              nextPolicy =
                writeTrainingResourceLibrary(
                  nextPolicy,
                  {
                    resources:
                      impact.library.resources.filter(
                        (item) =>
                          item.id !==
                          entityId,
                      ),
                    modules:
                      impact.library.modules,
                  },
                );
            } else {
              nextPolicy =
                writeTrainingResourceLibrary(
                  nextPolicy,
                  {
                    resources:
                      impact.library.resources,
                    modules:
                      impact.library.modules.filter(
                        (item) =>
                          item.id !==
                          entityId,
                      ),
                  },
                );

              for (
                const trainingSlotId of
                impact.referencedSlotIds
              ) {
                const assignments =
                  readProgrammeModuleAssignments(
                    nextPolicy,
                    trainingSlotId,
                  )
                    .filter(
                      (assignment) =>
                        assignment.moduleId !==
                        entityId,
                    );

                nextPolicy =
                  writeProgrammeModuleAssignments(
                    nextPolicy,
                    trainingSlotId,
                    assignments,
                  );
              }
            }

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
                    humanAdmin.userId,
                },
              });

            return {
              kind: 'OK' as const,
              objectKeys:
                impact.objectKeys,
              programmeReferenceCount:
                impact.programmeReferences.length,
              moduleMembershipCount:
                impact.moduleMemberships.length,
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

      if (
        result.kind ===
        'NOT_FOUND'
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_entity_not_found',
          },
          404,
        );
      }

      if (
        result.kind ===
        'PROTECTED_HISTORY'
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_purge_blocked_by_history',
            blockers:
              result.blockers,
          },
          409,
        );
      }

      for (
        const objectKey of
        result.objectKeys
      ) {
        await bestEffortDeleteTrainingResourceObject(
          objectKey,
        );
      }

      await writeAudit(
        request,
        {
          actorId:
            humanAdmin.userId,
          action:
            'training_resource_library.purged',
          entityType:
            entityType ===
            'resource'
              ? 'TrainingResource'
              : 'TrainingModule',
          entityId,
          description:
            'SUPER_ADMIN permanently purged training content after dependency checks',
          meta: {
            programmeReferenceCount:
              result.programmeReferenceCount,
            moduleMembershipCount:
              result.moduleMembershipCount,
            removedObjectCount:
              result.objectKeys.length,
          },
        },
      );

      return json({
        ok: true,
        source:
          'admin_training_resource_library_purge',
        purged: {
          entityType,
          entityId,
        },
        library:
          result.library,
      });
    }

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

            const currentLibrary =
              readTrainingResourceLibrary(
                settings.trainingPolicy,
              );

            const nextResourceIds =
              new Set(
                library.resources.map(
                  (resource) =>
                    resource.id,
                ),
              );

            const nextModuleIds =
              new Set(
                library.modules.map(
                  (module) =>
                    module.id,
                ),
              );

            const removedResources =
              currentLibrary.resources.filter(
                (resource) =>
                  !nextResourceIds.has(
                    resource.id,
                  ),
              );

            const removedModules =
              currentLibrary.modules.filter(
                (module) =>
                  !nextModuleIds.has(
                    module.id,
                  ),
              );

            const protectedResource =
              removedResources.find(
                (resource) =>
                  resource.status !==
                  'draft',
              );

            if (protectedResource) {
              return {
                kind:
                  'PROTECTED_REMOVAL' as const,
                entityType:
                  'resource' as const,
                entityId:
                  protectedResource.id,
              };
            }

            const protectedModule =
              removedModules.find(
                (module) =>
                  module.status !==
                  'draft',
              );

            if (protectedModule) {
              return {
                kind:
                  'PROTECTED_REMOVAL' as const,
                entityType:
                  'module' as const,
                entityId:
                  protectedModule.id,
              };
            }

            if (
              removedModules.length
            ) {
              const removedModuleIds =
                new Set(
                  removedModules.map(
                    (module) =>
                      module.id,
                  ),
                );

              const slots =
                await tx
                  .clinicianTrainingSlot
                  .findMany({
                    select: {
                      id: true,
                    },
                  });

              for (
                const slot of
                slots
              ) {
                const assigned =
                  readProgrammeModuleAssignments(
                    settings.trainingPolicy,
                    slot.id,
                  )
                    .some(
                      (assignment) =>
                        removedModuleIds.has(
                          assignment.moduleId,
                        ),
                    );

                if (assigned) {
                  return {
                    kind:
                      'ENTITY_IN_USE' as const,
                    entityType:
                      'module' as const,
                    trainingSlotId:
                      slot.id,
                  };
                }
              }
            }

            const removedObjectKeys =
              Array.from(
                new Set(
                  removedResources.flatMap(
                    (resource) =>
                      resource.versions
                        .map(
                          (version) =>
                            String(
                              version.fileKey ||
                              '',
                            ).trim(),
                        )
                        .filter(Boolean),
                  ),
                ),
              );

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
              removedObjectKeys,
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

      if (
        result.kind ===
        'PROTECTED_REMOVAL'
      ) {
        return json(
          {
            ok: false,
            error:
              'super_admin_purge_required',
            entityType:
              result.entityType,
            entityId:
              result.entityId,
          },
          409,
        );
      }

      if (
        result.kind ===
        'ENTITY_IN_USE'
      ) {
        return json(
          {
            ok: false,
            error:
              'training_library_entity_in_use',
            entityType:
              result.entityType,
            trainingSlotId:
              result.trainingSlotId,
          },
          409,
        );
      }

      for (
        const objectKey of
        result.removedObjectKeys
      ) {
        await bestEffortDeleteTrainingResourceObject(
          objectKey,
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
