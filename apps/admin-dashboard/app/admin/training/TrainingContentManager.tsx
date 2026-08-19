'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  TRAINING_RESOURCE_ACCEPT,
  TrainingResourceUploadStage,
  uploadTrainingResourceFile,
} from '../../../lib/training-resource-upload';

type Audience =
  | 'clinician'
  | 'patient'
  | 'trainer'
  | 'observer'
  | 'admin'
  | 'assessor'
  | 'careport'
  | 'medreach'
  | 'staff'
  | 'client'
  | 'partner'
  | 'public';

type ResourceKind =
  | 'presentation'
  | 'handbook'
  | 'quick_guide'
  | 'sop'
  | 'video'
  | 'external_link'
  | 'assessment'
  | 'file'
  | 'other';

type ResourceVersion = {
  id: string;
  version: string;
  status:
    | 'draft'
    | 'current'
    | 'superseded'
    | 'retired';
  url: string | null;
  fileKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  publishedAt: string | null;
  effectiveFrom: string | null;
  retiredAt: string | null;
  supersedesVersionId: string | null;
  uploadedBy: string | null;
};

type Resource = {
  id: string;
  title: string;
  kind: ResourceKind;
  description: string | null;
  required: boolean;
  status:
    | 'draft'
    | 'published'
    | 'retired';
  audiences: Audience[];
  displayOrder: number;
  currentVersionId: string | null;
  versions: ResourceVersion[];
};

type Module = {
  id: string;
  title: string;
  summary: string | null;
  status:
    | 'draft'
    | 'published'
    | 'retired';
  displayOrder: number;
  resourceIds: string[];
};

type Assignment = {
  id: string;
  trainingSlotId: string;
  moduleId: string;
  scope:
    | 'programme'
    | 'sessions';
  sessionIds: string[];
  displayOrder: number;
  status:
    | 'draft'
    | 'published'
    | 'retired';
};

type SessionInput = {
  id: string;
  dayNumber: number;
  startLocal: string;
  endLocal: string;
  mode: string;
  trainerName: string;
};

type PreviewResource = Resource & {
  currentVersion:
    ResourceVersion | null;
};

type PreviewModule = Module & {
  assignmentId: string;
  assignmentScope:
    | 'programme'
    | 'sessions';
  sessionIds: string[];
  resources: PreviewResource[];
};

const AUDIENCES: Array<{
  value: Audience;
  label: string;
}> = [
  {
    value: 'clinician',
    label: 'Clinician',
  },
  {
    value: 'patient',
    label: 'Patient',
  },
  {
    value: 'trainer',
    label: 'Trainer',
  },
  {
    value: 'observer',
    label: 'Observer',
  },
  {
    value: 'admin',
    label: 'Admin',
  },
  {
    value: 'assessor',
    label: 'Assessor',
  },
  {
    value: 'careport',
    label: 'CarePort partner',
  },
  {
    value: 'medreach',
    label: 'MedReach partner',
  },
  {
    value: 'staff',
    label: 'Internal staff',
  },
  {
    value: 'client',
    label: 'Client organisation',
  },
  {
    value: 'partner',
    label: 'Enterprise partner',
  },
  {
    value: 'public',
    label: 'Public',
  },
];

const RESOURCE_KINDS: Array<{
  value: ResourceKind;
  label: string;
}> = [
  {
    value: 'presentation',
    label: 'Presentation',
  },
  {
    value: 'handbook',
    label: 'Handbook',
  },
  {
    value: 'quick_guide',
    label: 'Quick guide',
  },
  {
    value: 'sop',
    label: 'SOP',
  },
  {
    value: 'video',
    label: 'Video',
  },
  {
    value: 'external_link',
    label: 'External link',
  },
  {
    value: 'assessment',
    label: 'Assessment',
  },
  {
    value: 'file',
    label: 'File',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

function id(
  prefix: string,
) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cleanNumber(
  value: unknown,
  fallback: number,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? Math.max(
        1,
        Math.round(number),
      )
    : fallback;
}

function readJson(
  response: Response,
) {
  return response
    .json()
    .catch(() => null);
}


function fileSizeLabel(
  value: number | null,
) {
  const bytes =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return '';
  }

  if (
    bytes >=
    1024 * 1024
  ) {
    return `${(
      bytes /
      (
        1024 *
        1024
      )
    ).toFixed(1)} MB`;
  }

  return `${Math.max(
    1,
    Math.round(
      bytes /
      1024,
    ),
  )} KB`;
}

function localLabel(
  value: string,
) {
  if (!value) {
    return 'Time not set';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function currentVersion(
  resource: Resource,
) {
  return (
    resource.versions.find(
      (version) =>
        version.id ===
        resource.currentVersionId,
    ) ||
    resource.versions.find(
      (version) =>
        version.status ===
        'current',
    ) ||
    null
  );
}

function sessionDisplay(
  session: SessionInput,
) {
  return (
    `Session ${session.id} - ` +
    `${localLabel(session.startLocal)} - ` +
    `${session.mode}` +
    (
      session.trainerName
        ? ` - ${session.trainerName}`
        : ''
    )
  );
}

export default function TrainingContentManager({
  trainingSlotId,
  sessions,
  allowPermanentPurge = false,
}: {
  trainingSlotId:
    | string
    | null;
  sessions: SessionInput[];
  allowPermanentPurge?: boolean;
}) {
  const [
    resources,
    setResources,
  ] =
    useState<Resource[]>([]);

  const [
    modules,
    setModules,
  ] =
    useState<Module[]>([]);

  const [
    assignments,
    setAssignments,
  ] =
    useState<Assignment[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    savingLibrary,
    setSavingLibrary,
  ] =
    useState(false);

  const [
    savingAssignments,
    setSavingAssignments,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    previewRole,
    setPreviewRole,
  ] =
    useState<Audience>(
      'clinician',
    );

  const [
    previewModules,
    setPreviewModules,
  ] =
    useState<
      PreviewModule[]
    >([]);

  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);

  const [
    legacyCount,
    setLegacyCount,
  ] =
    useState(0);

  const [
    selectedModuleId,
    setSelectedModuleId,
  ] =
    useState('');


  const [
    uploadingVersionId,
    setUploadingVersionId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    uploadStage,
    setUploadStage,
  ] =
    useState<
      TrainingResourceUploadStage | null
    >(
      null,
    );

  const [
    accessingVersionId,
    setAccessingVersionId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    purgingEntityId,
    setPurgingEntityId,
  ] =
    useState<string | null>(
      null,
    );

  const groupedSessions =
    useMemo(() => {
      const map =
        new Map<
          number,
          SessionInput[]
        >();

      sessions.forEach(
        (session) => {
          const day =
            Math.max(
              1,
              Number(
                session.dayNumber ||
                1,
              ),
            );

          const current =
            map.get(day) ||
            [];

          current.push(
            session,
          );

          map.set(
            day,
            current,
          );
        },
      );

      return Array.from(
        map.entries(),
      ).sort(
        (
          [left],
          [right],
        ) =>
          left - right,
      );
    }, [
      sessions,
    ]);

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const url =
            trainingSlotId
              ? `/api/admin/training/materials?trainingSlotId=${encodeURIComponent(trainingSlotId)}&previewRole=${encodeURIComponent(previewRole)}`
              : '/api/admin/training/materials';

          const response =
            await fetch(
              url,
              {
                cache:
                  'no-store',
                headers: {
                  accept:
                    'application/json',
                },
              },
            );

          const body =
            await readJson(
              response,
            );

          if (
            !response.ok ||
            body?.ok !== true
          ) {
            throw new Error(
              body?.error ||
              `HTTP ${response.status}`,
            );
          }

          const library =
            body?.library ||
            {};

          setResources(
            Array.isArray(
              library.resources,
            )
              ? library.resources
              : [],
          );

          setModules(
            Array.isArray(
              library.modules,
            )
              ? library.modules
              : [],
          );

          setAssignments(
            Array.isArray(
              body?.assignments,
            )
              ? body.assignments
              : [],
          );

          setLegacyCount(
            Array.isArray(
              body?.materials,
            )
              ? body.materials
                  .length
              : 0,
          );

          setPreviewModules(
            Array.isArray(
              body?.preview
                ?.modules,
            )
              ? body.preview
                  .modules
              : [],
          );
        } catch (
          reason: any
        ) {
          setError(
            String(
              reason?.message ||
              'Unable to load reusable training content.',
            ),
          );
        } finally {
          setLoading(false);
        }
      },
      [
        previewRole,
        trainingSlotId,
      ],
    );

  useEffect(() => {
    void load();
  }, [
    load,
  ]);

  function patchResource(
    resourceId: string,
    patch: Partial<Resource>,
  ) {
    setResources(
      (current) =>
        current.map(
          (resource) =>
            resource.id ===
            resourceId
              ? {
                  ...resource,
                  ...patch,
                }
              : resource,
        ),
    );
  }

  function patchVersion(
    resourceId: string,
    versionId: string,
    patch:
      Partial<ResourceVersion>,
  ) {
    setResources(
      (current) =>
        current.map(
          (resource) =>
            resource.id ===
            resourceId
              ? {
                  ...resource,
                  versions:
                    resource.versions.map(
                      (version) =>
                        version.id ===
                        versionId
                          ? {
                              ...version,
                              ...patch,
                            }
                          : version,
                    ),
                }
              : resource,
        ),
    );
  }

  function addResource() {
    const resourceId =
      id('resource');

    const versionId =
      id('version');

    setResources(
      (current) => [
        ...current,
        {
          id: resourceId,
          title: '',
          kind: 'file',
          description: null,
          required: false,
          status: 'draft',
          audiences: [
            'clinician',
          ],
          displayOrder:
            current.length + 1,
          currentVersionId:
            versionId,
          versions: [
            {
              id:
                versionId,
              version:
                'v1.0',
              status:
                'current',
              url: null,
              fileKey:
                null,
              fileName:
                null,
              mimeType:
                null,
              sizeBytes:
                null,
              checksumSha256:
                null,
              publishedAt:
                null,
              effectiveFrom:
                null,
              retiredAt:
                null,
              supersedesVersionId:
                null,
              uploadedBy:
                null,
            },
          ],
        },
      ],
    );
  }

  function removeDraftResource(
    resource: Resource,
  ) {
    if (
      resource.status !==
      'draft'
    ) {
      setError(
        'Published or retired resources should be retired/versioned rather than deleted.',
      );
      return;
    }

    setResources(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            resource.id,
        ),
    );

    setModules(
      (current) =>
        current.map(
          (module) => ({
            ...module,
            resourceIds:
              module.resourceIds.filter(
                (resourceId) =>
                  resourceId !==
                  resource.id,
              ),
          }),
        ),
    );
  }

  function addVersion(
    resource: Resource,
  ) {
    const previous =
      currentVersion(
        resource,
      );

    const versionId =
      id('version');

    setResources(
      (current) =>
        current.map(
          (item) => {
            if (
              item.id !==
              resource.id
            ) {
              return item;
            }

            return {
              ...item,
              status:
                'draft',
              currentVersionId:
                versionId,
              versions: [
                ...item.versions.map(
                  (version) =>
                    version.id ===
                    previous?.id
                      ? {
                          ...version,
                          status:
                            'superseded' as const,
                        }
                      : version,
                ),
                {
                  id:
                    versionId,
                  version:
                    `v${item.versions.length + 1}.0`,
                  status:
                    'current',
                  url: null,
                  fileKey:
                    null,
                  fileName:
                    null,
                  mimeType:
                    null,
                  sizeBytes:
                    null,
                  checksumSha256:
                    null,
                  publishedAt:
                    null,
                  effectiveFrom:
                    null,
                  retiredAt:
                    null,
                  supersedesVersionId:
                    previous?.id ||
                    null,
                  uploadedBy:
                    null,
                },
              ],
            };
          },
        ),
    );

    setNotice(
      'New draft version created. Upload or link the new content, then republish the resource when ready.',
    );
  }

  function toggleAudience(
    resourceId: string,
    audience: Audience,
  ) {
    setResources(
      (current) =>
        current.map(
          (resource) => {
            if (
              resource.id !==
              resourceId
            ) {
              return resource;
            }

            const exists =
              resource.audiences.includes(
                audience,
              );

            const next =
              exists
                ? resource.audiences.filter(
                    (item) =>
                      item !==
                      audience,
                  )
                : [
                    ...resource.audiences,
                    audience,
                  ];

            return {
              ...resource,
              audiences:
                next.length
                  ? next
                  : [
                      'clinician',
                    ],
            };
          },
        ),
    );
  }

  function patchModule(
    moduleId: string,
    patch: Partial<Module>,
  ) {
    setModules(
      (current) =>
        current.map(
          (module) =>
            module.id ===
            moduleId
              ? {
                  ...module,
                  ...patch,
                }
              : module,
        ),
    );
  }

  function addModule() {
    setModules(
      (current) => [
        ...current,
        {
          id:
            id('module'),
          title: '',
          summary: null,
          status: 'draft',
          displayOrder:
            current.length + 1,
          resourceIds: [],
        },
      ],
    );
  }

  function removeDraftModule(
    module: Module,
  ) {
    if (
      module.status !==
      'draft'
    ) {
      setError(
        'Published or retired modules should be retired rather than deleted.',
      );
      return;
    }

    setModules(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            module.id,
        ),
    );

    setAssignments(
      (current) =>
        current.filter(
          (assignment) =>
            assignment.moduleId !==
            module.id,
        ),
    );
  }

  function toggleModuleResource(
    moduleId: string,
    resourceId: string,
  ) {
    setModules(
      (current) =>
        current.map(
          (module) => {
            if (
              module.id !==
              moduleId
            ) {
              return module;
            }

            const exists =
              module.resourceIds.includes(
                resourceId,
              );

            return {
              ...module,
              resourceIds:
                exists
                  ? module.resourceIds.filter(
                      (item) =>
                        item !==
                        resourceId,
                    )
                  : [
                      ...module.resourceIds,
                      resourceId,
                    ],
            };
          },
        ),
    );
  }

  async function saveLibrary(
    options?: {
      quiet?: boolean;
    },
  ): Promise<boolean> {
    const invalidResource =
      resources.find(
        (resource) =>
          !resource.title.trim(),
      );

    if (
      invalidResource
    ) {
      setError(
        'Every saved resource requires a title.',
      );
      return false;
    }

    const invalidModule =
      modules.find(
        (module) =>
          !module.title.trim(),
      );

    if (
      invalidModule
    ) {
      setError(
        'Every saved module requires a title.',
      );
      return false;
    }

    const emptyPublishedModule =
      modules.find(
        (module) =>
          module.status ===
            'published' &&
          module.resourceIds
            .length === 0,
      );

    if (
      emptyPublishedModule
    ) {
      setError(
        'A published module must contain at least one saved resource.',
      );
      return false;
    }

    const publishedWithoutVersion =
      resources.find(
        (resource) => {
          if (
            resource.status !==
            'published'
          ) {
            return false;
          }

          const version =
            currentVersion(
              resource,
            );

          return (
            !version ||
            (
              !String(
                version.url ||
                '',
              ).trim() &&
              !String(
                version.fileKey ||
                '',
              ).trim()
            )
          );
        },
      );

    if (
      publishedWithoutVersion
    ) {
      setError(
        'Published resources require a current viewable URL or stored file. Keep incomplete resources in Draft.',
      );
      return false;
    }

    setSavingLibrary(true);
    setError(null);

    if (
      !options?.quiet
    ) {
      setNotice(null);
    }

    try {
      const response =
        await fetch(
          '/api/admin/training/materials',
          {
            method:
              'PATCH',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'save_library',
                library: {
                  resources:
                    resources.map(
                      (
                        resource,
                        index,
                      ) => ({
                        ...resource,
                        title:
                          resource.title.trim(),
                        displayOrder:
                          cleanNumber(
                            resource.displayOrder,
                            index + 1,
                          ),
                      }),
                    ),
                  modules:
                    modules.map(
                      (
                        module,
                        index,
                      ) => ({
                        ...module,
                        title:
                          module.title.trim(),
                        displayOrder:
                          cleanNumber(
                            module.displayOrder,
                            index + 1,
                          ),
                      }),
                    ),
                },
              }),
          },
        );

      const body =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setResources(
        Array.isArray(
          body?.library
            ?.resources,
        )
          ? body.library
              .resources
          : [],
      );

      setModules(
        Array.isArray(
          body?.library
            ?.modules,
        )
          ? body.library
              .modules
          : [],
      );

      if (
        !options?.quiet
      ) {
        setNotice(
          'Reusable training library saved.',
        );
      }

      return true;
    } catch (
      reason: any
    ) {
      setError(
        String(
          reason?.message ||
          'Unable to save the reusable training library.',
        ),
      );

      return false;
    } finally {
      setSavingLibrary(false);
    }
  }


  async function purgeLibraryEntity(
    entityType: 'resource' | 'module',
    entityId: string,
    title: string,
  ) {
    if (!allowPermanentPurge) {
      setError(
        'Permanent purge requires SUPER_ADMIN authority.',
      );
      return;
    }

    setPurgingEntityId(
      `${entityType}:${entityId}`,
    );
    setError(null);
    setNotice(null);

    try {
      const previewResponse =
        await fetch(
          '/api/admin/training/materials',
          {
            method: 'PATCH',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'preview_purge',
                entityType,
                entityId,
              }),
          },
        );

      const previewBody =
        await readJson(
          previewResponse,
        );

      if (
        !previewResponse.ok ||
        previewBody?.ok !== true
      ) {
        throw new Error(
          previewBody?.error ||
          `HTTP ${previewResponse.status}`,
        );
      }

      const preview =
        previewBody?.preview ||
        {};

      const blockers =
        Array.isArray(
          preview.blockers,
        )
          ? preview.blockers
              .map(
                (item: unknown) =>
                  String(item || '')
                    .trim(),
              )
              .filter(Boolean)
          : [];

      if (
        preview.canPurge !== true
      ) {
        setError(
          blockers.length
            ? `Permanent purge blocked: ${blockers.join(' ')}`
            : 'Permanent purge is blocked because this content has protected dependencies.',
        );
        return;
      }

      const programmeCount =
        Number(
          preview.programmeReferenceCount ||
          0,
        );

      const moduleCount =
        Number(
          preview.moduleMembershipCount ||
          0,
        );

      const typed =
        window.prompt(
          `Permanent purge cannot be undone.\n\n${title}\nAffected programme assignments: ${programmeCount}\nModule references: ${moduleCount}\n\nType PURGE to continue.`,
        );

      if (
        String(typed || '')
          .trim()
          .toUpperCase() !==
        'PURGE'
      ) {
        setNotice(
          'Permanent purge cancelled.',
        );
        return;
      }

      const purgeResponse =
        await fetch(
          '/api/admin/training/materials',
          {
            method: 'PATCH',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'purge_library_entity',
                entityType,
                entityId,
                confirmation:
                  `PURGE:${entityType}:${entityId}`,
              }),
          },
        );

      const purgeBody =
        await readJson(
          purgeResponse,
        );

      if (
        !purgeResponse.ok ||
        purgeBody?.ok !== true
      ) {
        throw new Error(
          purgeBody?.error ||
          `HTTP ${purgeResponse.status}`,
        );
      }

      setNotice(
        `${entityType === 'resource' ? 'Resource' : 'Module'} permanently purged.`,
      );

      await load();
    } catch (
      reason: any
    ) {
      setError(
        String(
          reason?.message ||
          'Unable to permanently purge training content.',
        ),
      );
    } finally {
      setPurgingEntityId(
        null,
      );
    }
  }


  async function uploadResourceVersion(
    resource: Resource,
    version: ResourceVersion,
    file: File,
  ) {
    setError(null);
    setNotice(null);

    const saved =
      await saveLibrary({
        quiet: true,
      });

    if (!saved) {
      return;
    }

    setUploadingVersionId(
      version.id,
    );

    try {
      const confirmed =
        await uploadTrainingResourceFile({
          file,
          resourceId:
            resource.id,
          versionId:
            version.id,
          onStage:
            setUploadStage,
        });

      if (
        Array.isArray(
          confirmed?.library
            ?.resources,
        )
      ) {
        setResources(
          confirmed.library
            .resources,
        );
      }

      if (
        Array.isArray(
          confirmed?.library
            ?.modules,
        )
      ) {
        setModules(
          confirmed.library
            .modules,
        );
      }

      setNotice(
        `Secure file uploaded and verified: ${file.name}`,
      );
    } catch (
      reason: any
    ) {
      setError(
        String(
          reason?.message ||
          'Unable to upload the training file.',
        ),
      );
    } finally {
      setUploadingVersionId(
        null,
      );
      setUploadStage(
        null,
      );
    }
  }

  async function openStoredResource(
    resource: Resource,
    version: ResourceVersion,
    disposition:
      | 'inline'
      | 'attachment',
  ) {
    if (
      !version.fileKey
    ) {
      setError(
        'This version does not have a stored file.',
      );
      return;
    }

    setAccessingVersionId(
      version.id,
    );
    setError(null);

    const popup =
      window.open(
        '',
        '_blank',
      );

    try {
      const response =
        await fetch(
          '/api/admin/training/materials',
          {
            method:
              'POST',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'access_file',
                resourceId:
                  resource.id,
                versionId:
                  version.id,
                disposition,
              }),
          },
        );

      const body =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        body?.ok !== true ||
        !body?.accessUrl
      ) {
        throw new Error(
          body?.message ||
          body?.error ||
          'Unable to create a secure file link.',
        );
      }

      if (popup) {
        popup.opener =
          null;
        popup.location.href =
          String(
            body.accessUrl,
          );
      } else {
        window.location.href =
          String(
            body.accessUrl,
          );
      }
    } catch (
      reason: any
    ) {
      if (
        popup &&
        !popup.closed
      ) {
        popup.close();
      }

      setError(
        String(
          reason?.message ||
          'Unable to open the stored training file.',
        ),
      );
    } finally {
      setAccessingVersionId(
        null,
      );
    }
  }

  function addAssignment() {
    if (
      !trainingSlotId
    ) {
      setError(
        'Save the programme before attaching reusable modules.',
      );
      return;
    }

    const moduleId =
      selectedModuleId ||
      modules.find(
        (module) =>
          module.status !==
          'retired',
      )?.id ||
      '';

    if (!moduleId) {
      setError(
        'Create and save a reusable module first.',
      );
      return;
    }

    setAssignments(
      (current) => [
        ...current,
        {
          id:
            id('assignment'),
          trainingSlotId,
          moduleId,
          scope:
            'programme',
          sessionIds: [],
          displayOrder:
            current.length + 1,
          status:
            'published',
        },
      ],
    );
  }

  function patchAssignment(
    assignmentId: string,
    patch:
      Partial<Assignment>,
  ) {
    setAssignments(
      (current) =>
        current.map(
          (assignment) =>
            assignment.id ===
            assignmentId
              ? {
                  ...assignment,
                  ...patch,
                }
              : assignment,
        ),
    );
  }

  function toggleAssignmentSession(
    assignmentId: string,
    sessionId: string,
  ) {
    setAssignments(
      (current) =>
        current.map(
          (assignment) => {
            if (
              assignment.id !==
              assignmentId
            ) {
              return assignment;
            }

            const exists =
              assignment.sessionIds.includes(
                sessionId,
              );

            return {
              ...assignment,
              sessionIds:
                exists
                  ? assignment.sessionIds.filter(
                      (item) =>
                        item !==
                        sessionId,
                    )
                  : [
                      ...assignment.sessionIds,
                      sessionId,
                    ],
            };
          },
        ),
    );
  }

  async function saveAssignments() {
    if (
      !trainingSlotId
    ) {
      setError(
        'Save the programme before assigning modules.',
      );
      return;
    }

    const invalid =
      assignments.find(
        (assignment) =>
          assignment.scope ===
            'sessions' &&
          assignment.sessionIds
            .length === 0,
      );

    if (invalid) {
      setError(
        'Every session-scoped module must be attached to at least one session.',
      );
      return;
    }

    setSavingAssignments(
      true,
    );
    setError(null);
    setNotice(null);

    try {
      const response =
        await fetch(
          '/api/admin/training/materials',
          {
            method:
              'PATCH',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'save_programme_content',
                trainingSlotId,
                previewRole,
                assignments:
                  assignments.map(
                    (
                      assignment,
                      index,
                    ) => ({
                      ...assignment,
                      displayOrder:
                        cleanNumber(
                          assignment.displayOrder,
                          index + 1,
                        ),
                    }),
                  ),
              }),
          },
        );

      const body =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setAssignments(
        Array.isArray(
          body?.assignments,
        )
          ? body.assignments
          : [],
      );

      setPreviewModules(
        Array.isArray(
          body?.preview
            ?.modules,
        )
          ? body.preview
              .modules
          : [],
      );

      setNotice(
        'Programme content assignments saved.',
      );
    } catch (
      reason: any
    ) {
      setError(
        String(
          reason?.message ||
          'Unable to save programme content assignments.',
        ),
      );
    } finally {
      setSavingAssignments(
        false,
      );
    }
  }

  async function refreshPreview(
    role = previewRole,
  ) {
    if (
      !trainingSlotId
    ) {
      setPreviewModules(
        [],
      );
      return;
    }

    setPreviewLoading(
      true,
    );
    setError(null);

    try {
      const response =
        await fetch(
          `/api/admin/training/materials?trainingSlotId=${encodeURIComponent(trainingSlotId)}&previewRole=${encodeURIComponent(role)}`,
          {
            cache:
              'no-store',
            headers: {
              accept:
                'application/json',
            },
          },
        );

      const body =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setPreviewModules(
        Array.isArray(
          body?.preview
            ?.modules,
        )
          ? body.preview
              .modules
          : [],
      );
    } catch (
      reason: any
    ) {
      setError(
        String(
          reason?.message ||
          'Unable to refresh role preview.',
        ),
      );
    } finally {
      setPreviewLoading(
        false,
      );
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-sm text-slate-600">
        Loading reusable training content...
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700">
          Reusable training content
        </div>
        <h3 className="mt-1 text-lg font-black text-slate-950">
          Resource Library - Modules - Programme / Session assignment
        </h3>
        <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
          Create a resource once, save it in the library, bundle resources into modules, then reuse those modules across programmes. Session assignment uses the stable session ID; day numbers are only visual grouping, so multiple sessions on the same day remain independent.
        </p>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">
          {error}
        </div>
      ) : null}

      <details
        open
        className="rounded-2xl border bg-white"
      >
        <summary className="cursor-pointer list-none p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-950">
                Resource Library
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {resources.length} saved resource{resources.length === 1 ? '' : 's'} - reusable across programmes.
              </div>
            </div>
            <span className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700">
              Global library
            </span>
          </div>
        </summary>

        <div className="border-t p-4">
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            P0.5A establishes the governed reusable library and Upload PDF, Word, PowerPoint, Excel and approved image files directly from your computer. Files are SHA-256 verified, stored through short-lived presigned object-storage URLs, and opened only through authenticated short-lived View/Download links.
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={addResource}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-800"
            >
              + New resource
            </button>

            <button
              type="button"
              disabled={
                savingLibrary
              }
              onClick={() =>
                void saveLibrary()
              }
              className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {savingLibrary
                ? 'Saving library...'
                : 'Save library'}
            </button>
          </div>

          {resources.length ===
          0 ? (
            <div className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">
              No reusable resources yet.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {resources.map(
                (
                  resource,
                  resourceIndex,
                ) => {
                  const version =
                    currentVersion(
                      resource,
                    );

                  return (
                    <div
                      key={
                        resource.id
                      }
                      className="rounded-2xl border bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-black text-slate-900">
                          Resource {resourceIndex + 1}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              addVersion(
                                resource,
                              )
                            }
                            className="text-[11px] font-black text-indigo-700"
                          >
                            New version
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeDraftResource(
                                resource,
                              )
                            }
                            className="text-[11px] font-black text-rose-700"
                          >
                            Delete draft
                          </button>

                          {allowPermanentPurge &&
                          resource.status !== 'draft' ? (
                            <button
                              type="button"
                              disabled={
                                purgingEntityId !== null
                              }
                              onClick={() =>
                                void purgeLibraryEntity(
                                  'resource',
                                  resource.id,
                                  resource.title ||
                                    'Untitled resource',
                                )
                              }
                              className="text-[11px] font-black text-rose-900 disabled:opacity-50"
                            >
                              {purgingEntityId ===
                              `resource:${resource.id}`
                                ? 'Purging...'
                                : 'Purge permanently'}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                          Resource title
                          <input
                            value={
                              resource.title
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  title:
                                    event.target.value,
                                },
                              )
                            }
                            placeholder="e.g. NexRing Quick Guide"
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Type
                          <select
                            value={
                              resource.kind
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  kind:
                                    event.target.value as ResourceKind,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          >
                            {RESOURCE_KINDS.map(
                              (
                                option,
                              ) => (
                                <option
                                  key={
                                    option.value
                                  }
                                  value={
                                    option.value
                                  }
                                >
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Lifecycle
                          <select
                            value={
                              resource.status
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  status:
                                    event.target.value as Resource['status'],
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          >
                            <option value="draft">
                              Draft
                            </option>
                            <option value="published">
                              Published
                            </option>
                            <option value="retired">
                              Retired
                            </option>
                          </select>
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Display order
                          <input
                            type="number"
                            min="1"
                            value={
                              resource.displayOrder
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  displayOrder:
                                    cleanNumber(
                                      event.target.value,
                                      resourceIndex + 1,
                                    ),
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="flex items-center gap-2 self-end rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={
                              resource.required
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  required:
                                    event.target.checked,
                                },
                              )
                            }
                          />
                          Required content
                        </label>

                        <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                          Description / learner guidance
                          <textarea
                            rows={3}
                            value={
                              resource.description ||
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              patchResource(
                                resource.id,
                                {
                                  description:
                                    event.target.value,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="mt-3">
                        <div className="text-[11px] font-black text-slate-700">
                          Audience visibility
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {AUDIENCES.map(
                            (
                              audience,
                            ) => (
                              <label
                                key={
                                  audience.value
                                }
                                className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={resource.audiences.includes(
                                    audience.value,
                                  )}
                                  onChange={() =>
                                    toggleAudience(
                                      resource.id,
                                      audience.value,
                                    )
                                  }
                                />
                                {audience.label}
                              </label>
                            ),
                          )}
                        </div>
                      </div>

                      {version ? (
                        <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-[11px] font-bold text-slate-700">
                              Current version
                              <input
                                value={
                                  version.version
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchVersion(
                                    resource.id,
                                    version.id,
                                    {
                                      version:
                                        event.target.value,
                                    },
                                  )
                                }
                                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                              />
                            </label>

                            <label className="text-[11px] font-bold text-slate-700">
                              Effective from
                              <input
                                type="datetime-local"
                                value={
                                  version.effectiveFrom
                                    ? version.effectiveFrom.slice(
                                        0,
                                        16,
                                      )
                                    : ''
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchVersion(
                                    resource.id,
                                    version.id,
                                    {
                                      effectiveFrom:
                                        event.target.value ||
                                        null,
                                    },
                                  )
                                }
                                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                              />
                            </label>

                            <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                              Current secure/external URL
                              <input
                                value={
                                  version.url ||
                                  ''
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchVersion(
                                    resource.id,
                                    version.id,
                                    {
                                      url:
                                        event.target.value,
                                    },
                                  )
                                }
                                placeholder="https://..."
                                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                              />
                            </label>


                            <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-[11px] font-black uppercase tracking-wide text-indigo-950">
                                    Native secure file
                                  </div>
                                  <div className="mt-1 text-[11px] leading-relaxed text-indigo-900">
                                    PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP. Maximum 25 MB. Upload automatically saves the current library first, hashes the file in your browser, verifies the stored object, and records the file against this exact resource version.
                                  </div>
                                </div>

                                <label className="cursor-pointer rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-black text-white">
                                  {uploadingVersionId === version.id
                                    ? uploadStage === 'hashing'
                                      ? 'Hashing...'
                                      : uploadStage === 'preparing'
                                        ? 'Preparing...'
                                        : uploadStage === 'uploading'
                                          ? 'Uploading...'
                                          : uploadStage === 'confirming'
                                            ? 'Verifying...'
                                            : 'Working...'
                                    : version.fileKey
                                      ? 'Replace file'
                                      : 'Upload file'}
                                  <input
                                    type="file"
                                    accept={TRAINING_RESOURCE_ACCEPT}
                                    disabled={
                                      uploadingVersionId !== null ||
                                      savingLibrary
                                    }
                                    onChange={(event) => {
                                      const file =
                                        event.target.files?.[0];

                                      event.currentTarget.value =
                                        '';

                                      if (file) {
                                        void uploadResourceVersion(
                                          resource,
                                          version,
                                          file,
                                        );
                                      }
                                    }}
                                    className="sr-only"
                                  />
                                </label>
                              </div>

                              {version.fileKey ? (
                                <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                                  <div className="text-xs font-black text-emerald-900">
                                    {version.fileName || 'Stored training file'}
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-600">
                                    {[version.mimeType, fileSizeLabel(version.sizeBytes), version.version]
                                      .filter(Boolean)
                                      .join(' - ')}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        accessingVersionId === version.id
                                      }
                                      onClick={() =>
                                        void openStoredResource(
                                          resource,
                                          version,
                                          'inline',
                                        )
                                      }
                                      className="rounded-lg border bg-white px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-50"
                                    >
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        accessingVersionId === version.id
                                      }
                                      onClick={() =>
                                        void openStoredResource(
                                          resource,
                                          version,
                                          'attachment',
                                        )
                                      }
                                      className="rounded-lg border bg-white px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-50"
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {resource.versions.length >
                          1 ? (
                            <div className="mt-2 text-[11px] text-slate-500">
                              Revision history: {resource.versions.map(
                                (
                                  item,
                                ) =>
                                  `${item.version} (${item.status})`,
                              ).join(' - ')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </details>

      <details
        open
        className="rounded-2xl border bg-white"
      >
        <summary className="cursor-pointer list-none p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-950">
                Module Library
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Bundle several saved resources into one reusable teaching module.
              </div>
            </div>
            <span className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700">
              {modules.length} module{modules.length === 1 ? '' : 's'}
            </span>
          </div>
        </summary>

        <div className="border-t p-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addModule}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-800"
            >
              + New module
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">
              No reusable modules yet.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {modules.map(
                (
                  module,
                  moduleIndex,
                ) => (
                  <div
                    key={
                      module.id
                    }
                    className="rounded-2xl border bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black text-slate-900">
                        Module {moduleIndex + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removeDraftModule(
                            module,
                          )
                        }
                        className="text-[11px] font-black text-rose-700"
                      >
                        Delete draft
                      </button>

                      {allowPermanentPurge &&
                      module.status !== 'draft' ? (
                        <button
                          type="button"
                          disabled={
                            purgingEntityId !== null
                          }
                          onClick={() =>
                            void purgeLibraryEntity(
                              'module',
                              module.id,
                              module.title ||
                                'Untitled module',
                            )
                          }
                          className="text-[11px] font-black text-rose-900 disabled:opacity-50"
                        >
                          {purgingEntityId ===
                          `module:${module.id}`
                            ? 'Purging...'
                            : 'Purge permanently'}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                        Module title
                        <input
                          value={
                            module.title
                          }
                          onChange={(
                            event,
                          ) =>
                            patchModule(
                              module.id,
                              {
                                title:
                                  event.target.value,
                              },
                            )
                          }
                          placeholder="e.g. IoMT & Simulation"
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-[11px] font-bold text-slate-700">
                        Lifecycle
                        <select
                          value={
                            module.status
                          }
                          onChange={(
                            event,
                          ) =>
                            patchModule(
                              module.id,
                              {
                                status:
                                  event.target.value as Module['status'],
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        >
                          <option value="draft">
                            Draft
                          </option>
                          <option value="published">
                            Published
                          </option>
                          <option value="retired">
                            Retired
                          </option>
                        </select>
                      </label>

                      <label className="text-[11px] font-bold text-slate-700">
                        Display order
                        <input
                          type="number"
                          min="1"
                          value={
                            module.displayOrder
                          }
                          onChange={(
                            event,
                          ) =>
                            patchModule(
                              module.id,
                              {
                                displayOrder:
                                  cleanNumber(
                                    event.target.value,
                                    moduleIndex + 1,
                                  ),
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                        Module summary
                        <textarea
                          rows={2}
                          value={
                            module.summary ||
                            ''
                          }
                          onChange={(
                            event,
                          ) =>
                            patchModule(
                              module.id,
                              {
                                summary:
                                  event.target.value,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-3">
                      <div className="text-[11px] font-black text-slate-700">
                        Resources in this module
                      </div>

                      {resources.length ===
                      0 ? (
                        <div className="mt-2 text-xs text-slate-500">
                          Create library resources first.
                        </div>
                      ) : (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {resources.map(
                            (
                              resource,
                            ) => (
                              <label
                                key={
                                  resource.id
                                }
                                className="flex items-start gap-2 rounded-xl border bg-white p-2 text-xs text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={module.resourceIds.includes(
                                    resource.id,
                                  )}
                                  onChange={() =>
                                    toggleModuleResource(
                                      module.id,
                                      resource.id,
                                    )
                                  }
                                />
                                <span>
                                  <span className="font-black">
                                    {resource.title || 'Untitled resource'}
                                  </span>
                                  <span className="block text-[11px] text-slate-500">
                                    {resource.kind} - {resource.status}
                                  </span>
                                </span>
                              </label>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={
                savingLibrary
              }
              onClick={() =>
                void saveLibrary()
              }
              className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {savingLibrary
                ? 'Saving library...'
                : 'Save resources & modules'}
            </button>
          </div>
        </div>
      </details>

      <details
        open
        className="rounded-2xl border bg-white"
      >
        <summary className="cursor-pointer list-none p-4">
          <div>
            <div className="text-sm font-black text-slate-950">
              Programme / Session assignments
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Attach saved modules programme-wide or to one or more actual sessions. A day may contain multiple independent sessions.
            </div>
          </div>
        </summary>

        <div className="border-t p-4">
          {!trainingSlotId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              Save the programme first, then attach reusable modules to it.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[260px] flex-1 text-[11px] font-bold text-slate-700">
                  Saved module
                  <select
                    value={
                      selectedModuleId
                    }
                    onChange={(
                      event,
                    ) =>
                      setSelectedModuleId(
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">
                      Select a module
                    </option>
                    {modules
                      .filter(
                        (module) =>
                          module.status !==
                          'retired',
                      )
                      .map(
                        (module) => (
                          <option
                            key={
                              module.id
                            }
                            value={
                              module.id
                            }
                          >
                            {module.title || 'Untitled module'}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={addAssignment}
                  className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-800"
                >
                  Attach module
                </button>
              </div>

              {assignments.length ===
              0 ? (
                <div className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">
                  No reusable module assignments for this programme yet.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {assignments.map(
                    (
                      assignment,
                      assignmentIndex,
                    ) => {
                      const module =
                        modules.find(
                          (item) =>
                            item.id ===
                            assignment.moduleId,
                        );

                      return (
                        <div
                          key={
                            assignment.id
                          }
                          className="rounded-2xl border bg-slate-50 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                {module?.title || assignment.moduleId}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Assignment {assignmentIndex + 1}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setAssignments(
                                  (
                                    current,
                                  ) =>
                                    current.filter(
                                      (
                                        item,
                                      ) =>
                                        item.id !==
                                        assignment.id,
                                    ),
                                )
                              }
                              className="text-[11px] font-black text-rose-700"
                            >
                              Remove assignment
                            </button>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <label className="text-[11px] font-bold text-slate-700">
                              Scope
                              <select
                                value={
                                  assignment.scope
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchAssignment(
                                    assignment.id,
                                    {
                                      scope:
                                        event.target.value as Assignment['scope'],
                                      sessionIds:
                                        event.target.value ===
                                        'programme'
                                          ? []
                                          : assignment.sessionIds,
                                    },
                                  )
                                }
                                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                              >
                                <option value="programme">
                                  Programme-wide
                                </option>
                                <option value="sessions">
                                  Specific session(s)
                                </option>
                              </select>
                            </label>

                            <label className="text-[11px] font-bold text-slate-700">
                              Publication
                              <select
                                value={
                                  assignment.status
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchAssignment(
                                    assignment.id,
                                    {
                                      status:
                                        event.target.value as Assignment['status'],
                                    },
                                  )
                                }
                                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                              >
                                <option value="draft">
                                  Draft
                                </option>
                                <option value="published">
                                  Published
                                </option>
                                <option value="retired">
                                  Retired
                                </option>
                              </select>
                            </label>

                            <label className="text-[11px] font-bold text-slate-700">
                              Order
                              <input
                                type="number"
                                min="1"
                                value={
                                  assignment.displayOrder
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchAssignment(
                                    assignment.id,
                                    {
                                      displayOrder:
                                        cleanNumber(
                                          event.target.value,
                                          assignmentIndex + 1,
                                        ),
                                    },
                                  )
                                }
                                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                              />
                            </label>
                          </div>

                          {assignment.scope ===
                          'sessions' ? (
                            <div className="mt-3 space-y-3">
                              {groupedSessions.length ===
                              0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                  This programme currently has no persisted sessions to target.
                                </div>
                              ) : (
                                groupedSessions.map(
                                  ([
                                    day,
                                    daySessions,
                                  ]) => (
                                    <div
                                      key={
                                        day
                                      }
                                    >
                                      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                        Day {day}
                                      </div>
                                      <div className="mt-1 grid gap-2">
                                        {daySessions.map(
                                          (
                                            session,
                                          ) => (
                                            <label
                                              key={
                                                session.id
                                              }
                                              className="flex items-start gap-2 rounded-xl border bg-white p-2 text-xs text-slate-700"
                                            >
                                              <input
                                                type="checkbox"
                                                className="mt-0.5"
                                                checked={assignment.sessionIds.includes(
                                                  session.id,
                                                )}
                                                onChange={() =>
                                                  toggleAssignmentSession(
                                                    assignment.id,
                                                    session.id,
                                                  )
                                                }
                                              />
                                              <span>
                                                <span className="font-black">
                                                  {sessionDisplay(
                                                    session,
                                                  )}
                                                </span>
                                                <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                                                  Session ID: {session.id}
                                                </span>
                                              </span>
                                            </label>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                              Available throughout the entire programme.
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={
                    savingAssignments
                  }
                  onClick={() =>
                    void saveAssignments()
                  }
                  className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {savingAssignments
                    ? 'Saving assignments...'
                    : 'Save programme assignments'}
                </button>
              </div>
            </>
          )}
        </div>
      </details>

      {trainingSlotId ? (
        <details
          open
          className="rounded-2xl border bg-white"
        >
          <summary className="cursor-pointer list-none p-4">
            <div>
              <div className="text-sm font-black text-slate-950">
                Role-aware preview
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Preview only the published content the selected audience is allowed to receive.
              </div>
            </div>
          </summary>

          <div className="border-t p-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] text-[11px] font-bold text-slate-700">
                Preview as
                <select
                  value={
                    previewRole
                  }
                  onChange={(
                    event,
                  ) => {
                    const role =
                      event.target.value as Audience;

                    setPreviewRole(
                      role,
                    );

                    void refreshPreview(
                      role,
                    );
                  }}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {AUDIENCES.map(
                    (
                      audience,
                    ) => (
                      <option
                        key={
                          audience.value
                        }
                        value={
                          audience.value
                        }
                      >
                        {audience.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                disabled={
                  previewLoading
                }
                onClick={() =>
                  void refreshPreview()
                }
                className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-800 disabled:opacity-50"
              >
                {previewLoading
                  ? 'Refreshing...'
                  : 'Refresh preview'}
              </button>
            </div>

            {previewModules.length ===
            0 ? (
              <div className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">
                No published reusable content is visible to {previewRole}.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {previewModules.map(
                  (
                    module,
                  ) => (
                    <div
                      key={
                        module.assignmentId
                      }
                      className="rounded-2xl border bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            {module.title}
                          </div>
                          {module.summary ? (
                            <div className="mt-1 text-xs text-slate-600">
                              {module.summary}
                            </div>
                          ) : null}
                        </div>

                        <span className="rounded-full border bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                          {module.assignmentScope ===
                          'programme'
                            ? 'Programme-wide'
                            : `${module.sessionIds.length} session(s)`}
                        </span>
                      </div>

                      <div className="mt-2 space-y-2">
                        {module.resources.map(
                          (
                            resource,
                          ) => (
                            <div
                              key={
                                resource.id
                              }
                              className="rounded-xl border bg-white p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-slate-800">
                                  {resource.title}
                                </span>
                                <span className="text-[10px] uppercase text-slate-400">
                                  {resource.required
                                    ? 'Required'
                                    : 'Optional'}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                {resource.kind} - {resource.currentVersion?.version || 'no current version'}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            {legacyCount >
            0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                This programme also has {legacyCount} legacy programme-only material{legacyCount === 1 ? '' : 's'}. They remain available to clinicians/trainers/admins until you migrate or retire them.
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
