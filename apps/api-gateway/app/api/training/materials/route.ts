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
import {
  presignTrainingResourceAccess,
  trainingResourceObjectBelongsTo,
  trainingResourceStorageResponse,
  validateTrainingResourceUploadInput,
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
    value ===
      'patient' ||
    value ===
      'trainer' ||
    value ===
      'observer' ||
    value ===
      'admin'
  ) {
    return value;
  }

  return 'clinician';
}

async function resolveAuthority(
  request: NextRequest,
  input: {
    requestedSlotId?: unknown;
    expectedRoomId?: unknown;
    requestedClinicianId?: unknown;
  },
) {
  const joinToken =
    clean(
      request.headers.get(
        'x-join-token',
      ),
      12000,
    );

  const requestedSlotId =
    clean(
      input.requestedSlotId,
      160,
    );

  const expectedRoomId =
    clean(
      input.expectedRoomId,
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
      const error:
        any =
          new Error(
            'training_slot_admission_mismatch',
          );

      error.status =
        403;
      error.code =
        'training_slot_admission_mismatch';

      throw error;
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

    return {
      trainingSlotId,
      audience,
      identity,
    };
  }

  const requestedClinicianId =
    clean(
      input
        .requestedClinicianId,
      160,
    ) ||
    null;

  const authenticated =
    await resolveAuthenticatedClinician(
      request,
      requestedClinicianId,
    );

  if (!authenticated.ok) {
    return {
      response:
        authenticated.response,
    } as const;
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

  if (
    requestedSlotId &&
    bookedSlotId &&
    requestedSlotId !==
      bookedSlotId
  ) {
    const error:
      any =
        new Error(
          'training_slot_booking_mismatch',
        );

    error.status =
      403;
    error.code =
      'training_slot_booking_mismatch';

    throw error;
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

  return {
    trainingSlotId,
    audience,
    identity,
  };
}

async function loadTrainingContent(
  trainingSlotId: string,
  audience:
    TrainingContentAudience,
) {
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
    const error:
      any =
        new Error(
          'training_slot_not_found',
        );

    error.status =
      404;
    error.code =
      'training_slot_not_found';

    throw error;
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

  return {
    slot,
    sessions,
    resolved,
  };
}

function safeVersion(
  version: any,
) {
  if (!version) {
    return null;
  }

  const {
    fileKey,
    checksumSha256,
    uploadedBy,
    ...rest
  } =
    version;

  return {
    ...rest,
    hasStoredFile:
      Boolean(
        fileKey,
      ),
  };
}

function safeModules(
  modules: any[],
) {
  return modules.map(
    (module) => ({
      ...module,
      resources:
        Array.isArray(
          module?.resources,
        )
          ? module.resources.map(
              (
                resource: any,
              ) => {
                const {
                  versions,
                  currentVersion,
                  ...rest
                } =
                  resource;

                return {
                  ...rest,
                  versions:
                    Array.isArray(
                      versions,
                    )
                      ? versions.map(
                          safeVersion,
                        )
                      : [],
                  currentVersion:
                    safeVersion(
                      currentVersion,
                    ),
                };
              },
            )
          : [],
    }),
  );
}

function safeItems(
  items: any[],
) {
  return items.map(
    (item) => {
      const {
        fileKey,
        checksumSha256,
        uploadedBy,
        ...rest
      } =
        item || {};

      return {
        ...rest,
        fileKey:
          null,
        hasStoredFile:
          Boolean(
            fileKey,
          ),
      };
    },
  );
}

function responseForError(
  error: any,
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
        'training_materials_request_failed',
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

export async function GET(
  request: NextRequest,
) {
  try {
    const authority =
      await resolveAuthority(
        request,
        {
          requestedSlotId:
            request.nextUrl
              .searchParams
              .get(
                'trainingSlotId',
              ),
          expectedRoomId:
            request.nextUrl
              .searchParams
              .get(
                'roomId',
              ),
          requestedClinicianId:
            request.nextUrl
              .searchParams
              .get(
                'clinicianId',
              ),
        },
      );

    if (
      'response' in
      authority
    ) {
      return authority
        .response;
    }

    const {
      trainingSlotId,
      audience,
      identity,
    } =
      authority;

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

    const {
      slot,
      sessions,
      resolved,
    } =
      await loadTrainingContent(
        trainingSlotId,
        audience,
      );

    const items =
      safeItems(
        flattenResolvedTrainingContent(
          resolved,
        ),
      );

    const modules =
      safeModules(
        resolved.modules,
      );

    const legacyMaterials =
      safeItems(
        resolved.legacy,
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
      modules,
      legacyMaterials,
      items,
      materials:
        items,
    });
  } catch (
    error: any
  ) {
    console.error(
      '[training-materials][GET] error',
      error,
    );

    return responseForError(
      error,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request
        .json()
        .catch(
          () =>
            ({} as any),
        );

    const action =
      clean(
        body?.action,
        80,
      )
        .toLowerCase();

    if (
      action !==
      'access_file'
    ) {
      return json(
        {
          ok: false,
          error:
            'training_resource_action_invalid',
        },
        400,
      );
    }

    const authority =
      await resolveAuthority(
        request,
        {
          requestedSlotId:
            body
              ?.trainingSlotId,
          expectedRoomId:
            body
              ?.roomId,
          requestedClinicianId:
            body
              ?.clinicianId,
        },
      );

    if (
      'response' in
      authority
    ) {
      return authority
        .response;
    }

    const {
      trainingSlotId,
      audience,
      identity,
    } =
      authority;

    if (!trainingSlotId) {
      return json(
        {
          ok: false,
          error:
            'training_slot_required',
        },
        404,
      );
    }

    const {
      resolved,
    } =
      await loadTrainingContent(
        trainingSlotId,
        audience,
      );

    const resourceId =
      clean(
        body?.resourceId,
        160,
      );

    const versionId =
      clean(
        body?.versionId,
        160,
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

    const resource =
      resolved.modules
        .flatMap(
          (module) =>
            module.resources,
        )
        .find(
          (item) =>
            item.id ===
              resourceId &&
            item.currentVersion
              ?.id ===
              versionId,
        );

    const version =
      resource
        ?.currentVersion;

    if (
      !resource ||
      !version ||
      version.status !==
        'current' ||
      !version.fileKey
    ) {
      return json(
        {
          ok: false,
          error:
            'training_resource_file_not_authorized',
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
      clean(
        body?.disposition,
        40,
      )
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

    return json({
      ok: true,
      source:
        'role_authorized_training_resource_access',
      role:
        audience,
      identity,
      trainingSlotId,
      resourceId,
      versionId,
      fileName:
        upload.fileName,
      mimeType:
        upload.contentType,
      ...signed,
    });
  } catch (
    error: any
  ) {
    console.error(
      '[training-materials][POST] error',
      error,
    );

    return responseForError(
      error,
    );
  }
}
