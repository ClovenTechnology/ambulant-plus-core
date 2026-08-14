// apps/api-gateway/src/clinicians/onboarding/training-materials.ts

export type TrainingMaterialKind =
  | 'module'
  | 'document'
  | 'video'
  | 'link'
  | 'handbook'
  | 'guide'
  | 'other';

export type TrainingMaterial = {
  id: string;
  trainingSlotId?: string | null;
  title: string;
  kind: TrainingMaterialKind;
  url: string | null;
  fileKey: string | null;
  notes: string | null;
  required: boolean;
  active: boolean;
  displayOrder: number;
};

function cleanText(
  value: unknown,
  max: number,
) {
  const text =
    String(value ?? '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function asRecord(
  value: unknown,
): Record<string, any> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<string, any>;
}

function safeMaterialUrl(
  value: unknown,
) {
  const raw =
    cleanText(value, 2000);

  if (!raw) return null;

  if (
    raw.startsWith('/') &&
    !raw.startsWith('//')
  ) {
    return raw;
  }

  try {
    const parsed =
      new URL(raw);

    if (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:'
    ) {
      return parsed.toString();
    }
  } catch {
    // Invalid or unsafe URLs are not published.
  }

  return null;
}

function materialKind(
  value: unknown,
): TrainingMaterialKind {
  const kind =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    kind === 'document' ||
    kind === 'video' ||
    kind === 'link' ||
    kind === 'handbook' ||
    kind === 'guide' ||
    kind === 'other'
  ) {
    return kind;
  }

  return 'module';
}

export function normaliseTrainingMaterials(
  value: unknown,
  trainingSlotId?: string | null,
): TrainingMaterial[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(0, 100)
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingMaterial | null => {
        const title =
          cleanText(
            candidate?.title,
            240,
          );

        if (!title) {
          return null;
        }

        const baseId =
          cleanText(
            candidate?.id,
            120,
          ) ||
          `material-${index + 1}`;

        let id = baseId;
        let suffix = 2;

        while (seen.has(id)) {
          id =
            `${baseId}-${suffix}`;
          suffix += 1;
        }

        seen.add(id);

        const rawOrder =
          Number(
            candidate?.displayOrder ??
            index + 1,
          );

        return {
          id,
          trainingSlotId:
            trainingSlotId || null,
          title,
          kind:
            materialKind(
              candidate?.kind,
            ),
          url:
            safeMaterialUrl(
              candidate?.url,
            ),
          fileKey:
            cleanText(
              candidate?.fileKey,
              1000,
            ),
          notes:
            cleanText(
              candidate?.notes,
              4000,
            ),
          required:
            candidate?.required === true,
          active:
            candidate?.active !== false,
          displayOrder:
            Number.isFinite(rawOrder)
              ? Math.min(
                  500,
                  Math.max(
                    1,
                    Math.round(rawOrder),
                  ),
                )
              : index + 1,
        };
      },
    )
    .filter(
      (
        material,
      ): material is TrainingMaterial =>
        Boolean(material),
    )
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        left.title.localeCompare(
          right.title,
        ),
    );
}

export function readProgrammeTrainingMaterials(
  trainingPolicy: unknown,
  trainingSlotId: string,
  options?: {
    includeInactive?: boolean;
  },
) {
  const policy =
    asRecord(trainingPolicy);

  const programmes =
    asRecord(
      policy.programmeMaterials,
    );

  const materials =
    normaliseTrainingMaterials(
      programmes[trainingSlotId],
      trainingSlotId,
    );

  return options?.includeInactive === false
    ? materials.filter(
        (material) =>
          material.active,
      )
    : materials;
}

export function writeProgrammeTrainingMaterials(
  trainingPolicy: unknown,
  trainingSlotId: string,
  materials: unknown,
) {
  const policy =
    asRecord(trainingPolicy);

  const programmes = {
    ...asRecord(
      policy.programmeMaterials,
    ),
  };

  programmes[trainingSlotId] =
    normaliseTrainingMaterials(
      materials,
      trainingSlotId,
    ).map(
      ({
        trainingSlotId: _trainingSlotId,
        ...material
      }) => material,
    );

  return {
    ...policy,
    programmeMaterials:
      programmes,
  };
}

export type TrainingContentAudience =
  | 'clinician'
  | 'patient'
  | 'trainer'
  | 'observer'
  | 'admin'
  | 'assessor';

export type TrainingResourceKind =
  | 'presentation'
  | 'handbook'
  | 'quick_guide'
  | 'sop'
  | 'video'
  | 'external_link'
  | 'assessment'
  | 'file'
  | 'other';

export type TrainingResourceStatus =
  | 'draft'
  | 'published'
  | 'retired';

export type TrainingResourceVersionStatus =
  | 'draft'
  | 'current'
  | 'superseded'
  | 'retired';

export type TrainingResourceVersion = {
  id: string;
  version: string;
  status: TrainingResourceVersionStatus;
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

export type TrainingResource = {
  id: string;
  title: string;
  kind: TrainingResourceKind;
  description: string | null;
  required: boolean;
  status: TrainingResourceStatus;
  audiences: TrainingContentAudience[];
  displayOrder: number;
  currentVersionId: string | null;
  versions: TrainingResourceVersion[];
};

export type TrainingModule = {
  id: string;
  title: string;
  summary: string | null;
  status: 'draft' | 'published' | 'retired';
  displayOrder: number;
  resourceIds: string[];
};

export type TrainingResourceLibrary = {
  resources: TrainingResource[];
  modules: TrainingModule[];
};

export type TrainingModuleAssignment = {
  id: string;
  trainingSlotId: string;
  moduleId: string;
  scope: 'programme' | 'sessions';
  sessionIds: string[];
  displayOrder: number;
  status: 'draft' | 'published' | 'retired';
};

export type TrainingSessionRef = {
  id: string;
  dayNumber: number;
  startAt: string | null;
  endAt: string | null;
  mode: string | null;
  trainerName: string | null;
};

export type ResolvedTrainingResource = TrainingResource & {
  currentVersion: TrainingResourceVersion | null;
};

export type ResolvedTrainingModule = TrainingModule & {
  assignmentId: string;
  assignmentScope: 'programme' | 'sessions';
  sessionIds: string[];
  resources: ResolvedTrainingResource[];
};

const RESOURCE_LIBRARY_KEY =
  '__resourceLibraryV1';

const PROGRAMME_CONTENT_KEY =
  '__programmeContentV1';

const ALL_AUDIENCES: TrainingContentAudience[] = [
  'clinician',
  'patient',
  'trainer',
  'observer',
  'admin',
  'assessor',
];

function cleanIdValue(
  value: unknown,
  fallback: string,
) {
  return (
    cleanText(
      value,
      160,
    ) ||
    fallback
  );
}

function cleanIsoValue(
  value: unknown,
) {
  const text =
    cleanText(
      value,
      80,
    );

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function cleanPositiveInt(
  value: unknown,
  fallback: number,
  max = 10_000,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      1,
      Math.round(number),
    ),
  );
}

function cleanNonNegativeInt(
  value: unknown,
  max = 1024 * 1024 * 1024,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return Math.min(
    max,
    Math.round(number),
  );
}

function uniqueTextList(
  value: unknown,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (item) =>
            cleanText(
              item,
              maxLength,
            ),
        )
        .filter(
          (
            item,
          ): item is string =>
            Boolean(item),
        ),
    ),
  ).slice(
    0,
    maxItems,
  );
}

function resourceKind(
  value: unknown,
): TrainingResourceKind {
  const kind =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    kind === 'presentation' ||
    kind === 'handbook' ||
    kind === 'quick_guide' ||
    kind === 'sop' ||
    kind === 'video' ||
    kind === 'external_link' ||
    kind === 'assessment' ||
    kind === 'file' ||
    kind === 'other'
  ) {
    return kind;
  }

  return 'file';
}

function resourceStatus(
  value: unknown,
): TrainingResourceStatus {
  const status =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    status === 'draft' ||
    status === 'retired'
  ) {
    return status;
  }

  return 'published';
}

function versionStatus(
  value: unknown,
): TrainingResourceVersionStatus {
  const status =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    status === 'draft' ||
    status === 'superseded' ||
    status === 'retired'
  ) {
    return status;
  }

  return 'current';
}

function moduleStatus(
  value: unknown,
): 'draft' | 'published' | 'retired' {
  const status =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    status === 'draft' ||
    status === 'retired'
  ) {
    return status;
  }

  return 'published';
}

function audiences(
  value: unknown,
): TrainingContentAudience[] {
  const supported =
    new Set(
      ALL_AUDIENCES,
    );

  const values =
    uniqueTextList(
      value,
      ALL_AUDIENCES.length,
      40,
    )
      .map(
        (item) =>
          item.toLowerCase(),
      )
      .filter(
        (
          item,
        ): item is TrainingContentAudience =>
          supported.has(
            item as TrainingContentAudience,
          ),
      );

  return values.length
    ? values
    : ['clinician'];
}

function normaliseResourceVersions(
  value: unknown,
  resourceId: string,
): TrainingResourceVersion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(
      0,
      50,
    )
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingResourceVersion => {
        const baseId =
          cleanIdValue(
            candidate?.id,
            `${resourceId}-version-${index + 1}`,
          );

        let id =
          baseId;
        let suffix = 2;

        while (
          seen.has(id)
        ) {
          id =
            `${baseId}-${suffix}`;
          suffix += 1;
        }

        seen.add(id);

        const checksum =
          cleanText(
            candidate?.checksumSha256,
            128,
          );

        return {
          id,
          version:
            cleanText(
              candidate?.version,
              80,
            ) ||
            `v${index + 1}`,
          status:
            versionStatus(
              candidate?.status,
            ),
          url:
            safeMaterialUrl(
              candidate?.url,
            ),
          fileKey:
            cleanText(
              candidate?.fileKey,
              1000,
            ),
          fileName:
            cleanText(
              candidate?.fileName,
              320,
            ),
          mimeType:
            cleanText(
              candidate?.mimeType,
              240,
            ),
          sizeBytes:
            cleanNonNegativeInt(
              candidate?.sizeBytes,
            ),
          checksumSha256:
            checksum &&
            /^[a-f0-9]{64}$/i.test(
              checksum,
            )
              ? checksum.toLowerCase()
              : null,
          publishedAt:
            cleanIsoValue(
              candidate?.publishedAt,
            ),
          effectiveFrom:
            cleanIsoValue(
              candidate?.effectiveFrom,
            ),
          retiredAt:
            cleanIsoValue(
              candidate?.retiredAt,
            ),
          supersedesVersionId:
            cleanText(
              candidate?.supersedesVersionId,
              160,
            ),
          uploadedBy:
            cleanText(
              candidate?.uploadedBy,
              240,
            ),
        };
      },
    );
}

function normaliseResources(
  value: unknown,
): TrainingResource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(
      0,
      500,
    )
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingResource | null => {
        const title =
          cleanText(
            candidate?.title,
            240,
          );

        if (!title) {
          return null;
        }

        const baseId =
          cleanIdValue(
            candidate?.id,
            `resource-${index + 1}`,
          );

        let id =
          baseId;
        let suffix = 2;

        while (
          seen.has(id)
        ) {
          id =
            `${baseId}-${suffix}`;
          suffix += 1;
        }

        seen.add(id);

        let versions =
          normaliseResourceVersions(
            candidate?.versions,
            id,
          );

        if (
          versions.length === 0 &&
          (
            candidate?.url ||
            candidate?.fileKey
          )
        ) {
          versions = [
            {
              id:
                `${id}-version-1`,
              version:
                cleanText(
                  candidate?.version,
                  80,
                ) ||
                'v1.0',
              status:
                'current',
              url:
                safeMaterialUrl(
                  candidate?.url,
                ),
              fileKey:
                cleanText(
                  candidate?.fileKey,
                  1000,
                ),
              fileName:
                cleanText(
                  candidate?.fileName,
                  320,
                ),
              mimeType:
                cleanText(
                  candidate?.mimeType,
                  240,
                ),
              sizeBytes:
                cleanNonNegativeInt(
                  candidate?.sizeBytes,
                ),
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
          ];
        }

        const requestedCurrent =
          cleanText(
            candidate?.currentVersionId,
            160,
          );

        const currentVersion =
          (
            requestedCurrent &&
            versions.find(
              (version) =>
                version.id ===
                requestedCurrent,
            )
          ) ||
          versions.find(
            (version) =>
              version.status ===
              'current',
          ) ||
          null;

        return {
          id,
          title,
          kind:
            resourceKind(
              candidate?.kind,
            ),
          description:
            cleanText(
              candidate?.description ??
              candidate?.notes,
              4000,
            ),
          required:
            candidate?.required === true,
          status:
            resourceStatus(
              candidate?.status,
            ),
          audiences:
            audiences(
              candidate?.audiences,
            ),
          displayOrder:
            cleanPositiveInt(
              candidate?.displayOrder,
              index + 1,
              5000,
            ),
          currentVersionId:
            currentVersion?.id ||
            null,
          versions,
        };
      },
    )
    .filter(
      (
        resource,
      ): resource is TrainingResource =>
        Boolean(resource),
    )
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        left.title.localeCompare(
          right.title,
        ),
    );
}

function normaliseModules(
  value: unknown,
  knownResourceIds: Set<string>,
): TrainingModule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(
      0,
      300,
    )
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingModule | null => {
        const title =
          cleanText(
            candidate?.title,
            240,
          );

        if (!title) {
          return null;
        }

        const baseId =
          cleanIdValue(
            candidate?.id,
            `module-${index + 1}`,
          );

        let id =
          baseId;
        let suffix = 2;

        while (
          seen.has(id)
        ) {
          id =
            `${baseId}-${suffix}`;
          suffix += 1;
        }

        seen.add(id);

        return {
          id,
          title,
          summary:
            cleanText(
              candidate?.summary,
              4000,
            ),
          status:
            moduleStatus(
              candidate?.status,
            ),
          displayOrder:
            cleanPositiveInt(
              candidate?.displayOrder,
              index + 1,
              5000,
            ),
          resourceIds:
            uniqueTextList(
              candidate?.resourceIds,
              200,
              160,
            ).filter(
              (resourceId) =>
                knownResourceIds.has(
                  resourceId,
                ),
            ),
        };
      },
    )
    .filter(
      (
        module,
      ): module is TrainingModule =>
        Boolean(module),
    )
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        left.title.localeCompare(
          right.title,
        ),
    );
}

export function normaliseTrainingResourceLibrary(
  value: unknown,
): TrainingResourceLibrary {
  const record =
    asRecord(value);

  const resources =
    normaliseResources(
      record.resources,
    );

  const resourceIds =
    new Set(
      resources.map(
        (resource) =>
          resource.id,
      ),
    );

  return {
    resources,
    modules:
      normaliseModules(
        record.modules,
        resourceIds,
      ),
  };
}

export function readTrainingResourceLibrary(
  trainingPolicy: unknown,
): TrainingResourceLibrary {
  const policy =
    asRecord(
      trainingPolicy,
    );

  const programmes =
    asRecord(
      policy.programmeMaterials,
    );

  return normaliseTrainingResourceLibrary(
    programmes[
      RESOURCE_LIBRARY_KEY
    ],
  );
}

export function writeTrainingResourceLibrary(
  trainingPolicy: unknown,
  library: unknown,
) {
  const policy =
    asRecord(
      trainingPolicy,
    );

  const programmes = {
    ...asRecord(
      policy.programmeMaterials,
    ),
  };

  programmes[
    RESOURCE_LIBRARY_KEY
  ] =
    normaliseTrainingResourceLibrary(
      library,
    );

  return {
    ...policy,
    programmeMaterials:
      programmes,
  };
}

function normaliseAssignments(
  value: unknown,
  trainingSlotId: string,
  knownModuleIds?: Set<string>,
  allowedSessionIds?: Set<string>,
): TrainingModuleAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(
      0,
      300,
    )
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingModuleAssignment | null => {
        const moduleId =
          cleanText(
            candidate?.moduleId,
            160,
          );

        if (
          !moduleId ||
          (
            knownModuleIds &&
            !knownModuleIds.has(
              moduleId,
            )
          )
        ) {
          return null;
        }

        const baseId =
          cleanIdValue(
            candidate?.id,
            `assignment-${index + 1}`,
          );

        let id =
          baseId;
        let suffix = 2;

        while (
          seen.has(id)
        ) {
          id =
            `${baseId}-${suffix}`;
          suffix += 1;
        }

        seen.add(id);

        const scope =
          String(
            candidate?.scope ??
            '',
          )
            .trim()
            .toLowerCase() ===
          'sessions'
            ? 'sessions'
            : 'programme';

        const sessionIds =
          scope ===
          'sessions'
            ? uniqueTextList(
                candidate?.sessionIds,
                100,
                160,
              ).filter(
                (sessionId) =>
                  !allowedSessionIds ||
                  allowedSessionIds.has(
                    sessionId,
                  ),
              )
            : [];

        if (
          scope ===
            'sessions' &&
          sessionIds.length === 0
        ) {
          return null;
        }

        return {
          id,
          trainingSlotId,
          moduleId,
          scope,
          sessionIds,
          displayOrder:
            cleanPositiveInt(
              candidate?.displayOrder,
              index + 1,
              5000,
            ),
          status:
            moduleStatus(
              candidate?.status,
            ),
        };
      },
    )
    .filter(
      (
        assignment,
      ): assignment is TrainingModuleAssignment =>
        Boolean(assignment),
    )
    .sort(
      (left, right) =>
        left.displayOrder -
          right.displayOrder ||
        left.id.localeCompare(
          right.id,
        ),
    );
}

export function readProgrammeModuleAssignments(
  trainingPolicy: unknown,
  trainingSlotId: string,
) {
  const policy =
    asRecord(
      trainingPolicy,
    );

  const programmes =
    asRecord(
      policy.programmeMaterials,
    );

  const content =
    asRecord(
      programmes[
        PROGRAMME_CONTENT_KEY
      ],
    );

  return normaliseAssignments(
    content[trainingSlotId],
    trainingSlotId,
  );
}

export function writeProgrammeModuleAssignments(
  trainingPolicy: unknown,
  trainingSlotId: string,
  assignments: unknown,
  options?: {
    knownModuleIds?: Set<string>;
    allowedSessionIds?: Set<string>;
  },
) {
  const policy =
    asRecord(
      trainingPolicy,
    );

  const programmes = {
    ...asRecord(
      policy.programmeMaterials,
    ),
  };

  const content = {
    ...asRecord(
      programmes[
        PROGRAMME_CONTENT_KEY
      ],
    ),
  };

  content[trainingSlotId] =
    normaliseAssignments(
      assignments,
      trainingSlotId,
      options?.knownModuleIds,
      options?.allowedSessionIds,
    ).map(
      ({
        trainingSlotId:
          _trainingSlotId,
        ...assignment
      }) => assignment,
    );

  programmes[
    PROGRAMME_CONTENT_KEY
  ] =
    content;

  return {
    ...policy,
    programmeMaterials:
      programmes,
  };
}

export function normaliseTrainingSessionRefs(
  value: unknown,
): TrainingSessionRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set<string>();

  return value
    .slice(
      0,
      100,
    )
    .map(
      (
        candidate: any,
        index: number,
      ): TrainingSessionRef | null => {
        const id =
          cleanText(
            candidate?.id,
            160,
          );

        if (
          !id ||
          seen.has(id)
        ) {
          return null;
        }

        seen.add(id);

        return {
          id,
          dayNumber:
            cleanPositiveInt(
              candidate?.dayNumber,
              index + 1,
              365,
            ),
          startAt:
            cleanIsoValue(
              candidate?.startAt,
            ),
          endAt:
            cleanIsoValue(
              candidate?.endAt,
            ),
          mode:
            cleanText(
              candidate?.mode,
              40,
            ),
          trainerName:
            cleanText(
              candidate?.trainerName,
              240,
            ),
        };
      },
    )
    .filter(
      (
        session,
      ): session is TrainingSessionRef =>
        Boolean(session),
    );
}

function currentVersionForResource(
  resource: TrainingResource,
) {
  if (
    resource.currentVersionId
  ) {
    const selected =
      resource.versions.find(
        (version) =>
          version.id ===
          resource.currentVersionId,
      );

    if (selected) {
      return selected;
    }
  }

  return (
    resource.versions.find(
      (version) =>
        version.status ===
        'current',
    ) ||
    null
  );
}

export function resolveProgrammeTrainingContent(
  trainingPolicy: unknown,
  trainingSlotId: string,
  audience: TrainingContentAudience,
  options?: {
    includeDraft?: boolean;
    includeLegacy?: boolean;
  },
) {
  const includeDraft =
    options?.includeDraft === true;

  const library =
    readTrainingResourceLibrary(
      trainingPolicy,
    );

  const moduleById =
    new Map(
      library.modules.map(
        (module) => [
          module.id,
          module,
        ],
      ),
    );

  const resourceById =
    new Map(
      library.resources.map(
        (resource) => [
          resource.id,
          resource,
        ],
      ),
    );

  const modules =
    readProgrammeModuleAssignments(
      trainingPolicy,
      trainingSlotId,
    )
      .filter(
        (assignment) =>
          includeDraft ||
          assignment.status ===
            'published',
      )
      .map(
        (
          assignment,
        ): ResolvedTrainingModule | null => {
          const module =
            moduleById.get(
              assignment.moduleId,
            );

          if (
            !module ||
            (
              !includeDraft &&
              module.status !==
                'published'
            )
          ) {
            return null;
          }

          const resources =
            module.resourceIds
              .map(
                (resourceId) =>
                  resourceById.get(
                    resourceId,
                  ) ||
                  null,
              )
              .filter(
                (
                  resource,
                ): resource is TrainingResource =>
                  Boolean(resource),
              )
              .filter(
                (resource) =>
                  (
                    includeDraft ||
                    resource.status ===
                      'published'
                  ) &&
                  resource.audiences.includes(
                    audience,
                  ),
              )
              .map(
                (resource) => ({
                  ...resource,
                  currentVersion:
                    currentVersionForResource(
                      resource,
                    ),
                }),
              )
              .filter(
                (resource) =>
                  includeDraft ||
                  (
                    resource.currentVersion &&
                    resource.currentVersion
                      .status ===
                      'current'
                  ),
              )
              .sort(
                (left, right) =>
                  left.displayOrder -
                    right.displayOrder ||
                  left.title.localeCompare(
                    right.title,
                  ),
              );

          if (
            resources.length === 0
          ) {
            return null;
          }

          return {
            ...module,
            assignmentId:
              assignment.id,
            assignmentScope:
              assignment.scope,
            sessionIds: [
              ...assignment.sessionIds,
            ],
            resources,
          };
        },
      )
      .filter(
        (
          module,
        ): module is ResolvedTrainingModule =>
          Boolean(module),
      );

  const legacy =
    (
      options?.includeLegacy !==
        false &&
      (
        audience ===
          'clinician' ||
        audience ===
          'trainer' ||
        audience ===
          'admin'
      )
    )
      ? readProgrammeTrainingMaterials(
          trainingPolicy,
          trainingSlotId,
          {
            includeInactive:
              includeDraft,
          },
        )
      : [];

  return {
    trainingSlotId,
    audience,
    modules,
    legacy,
  };
}

export function flattenResolvedTrainingContent(
  content: ReturnType<
    typeof resolveProgrammeTrainingContent
  >,
) {
  const resources =
    content.modules.flatMap(
      (module) =>
        module.resources.map(
          (resource) => {
            const version =
              resource.currentVersion;

            return {
              id:
                `${module.assignmentId}:${resource.id}:${version?.id || 'none'}`,
              trainingSlotId:
                content.trainingSlotId,
              moduleId:
                module.id,
              moduleTitle:
                module.title,
              assignmentId:
                module.assignmentId,
              assignmentScope:
                module.assignmentScope,
              sessionIds:
                module.sessionIds,
              resourceId:
                resource.id,
              resourceVersionId:
                version?.id ||
                null,
              title:
                resource.title,
              kind:
                resource.kind,
              url:
                version?.url ||
                null,
              fileKey:
                version?.fileKey ||
                null,
              fileName:
                version?.fileName ||
                null,
              mimeType:
                version?.mimeType ||
                null,
              version:
                version?.version ||
                null,
              notes:
                resource.description,
              required:
                resource.required,
              audiences:
                resource.audiences,
              displayOrder:
                resource.displayOrder,
            };
          },
        ),
    );

  return [
    ...resources,
    ...content.legacy,
  ];
}
