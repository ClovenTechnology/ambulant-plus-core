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
