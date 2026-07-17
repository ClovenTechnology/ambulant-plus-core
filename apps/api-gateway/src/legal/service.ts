import { createHash } from 'node:crypto';
import { prisma } from '@/src/lib/db';
import {
  LEGAL_DOCUMENT_CATALOG_BY_KEY,
  type LegalDocumentKey,
} from '@/src/legal/catalog';

type LegalActor = {
  userId: string | null;
  role: string | null;
};

type AdminActionInput = {
  orgId: string;
  actor: LegalActor;
  action: string;
  body: Record<string, unknown>;
};

type AcknowledgementInput = {
  orgId: string;
  legalDocumentVersionId?: string | null;
  documentKey?: string | null;
  subjectType: string;
  subjectUserId?: string | null;
  subjectId?: string | null;
  application: string;
  surface?: string | null;
  action?: string | null;
  locale?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  evidence?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
};

const VERSION_STATES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'SUPERSEDED',
  'RETIRED',
] as const;

const ACKNOWLEDGEMENT_ACTIONS = [
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
] as const;

function fail(
  message: string,
  status = 400,
): never {
  const error = new Error(
    message,
  );

  (error as any).status =
    status;

  throw error;
}

export function legalRouteErrorStatus(
  error: unknown,
) {
  const explicit =
    Number(
      (error as any)?.status,
    );

  if (
    Number.isInteger(
      explicit,
    ) &&
    explicit >= 400 &&
    explicit <= 599
  ) {
    return explicit;
  }

  const message =
    String(
      (error as any)?.message ||
      '',
    ).toLowerCase();

  if (
    message ===
    'unauthorized'
  ) {
    return 401;
  }

  if (
    message ===
    'forbidden'
  ) {
    return 403;
  }

  return 500;
}

function text(
  value: unknown,
  max = 500,
) {
  return String(
    value ??
    '',
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function nullableText(
  value: unknown,
  max = 500,
) {
  const result =
    text(
      value,
      max,
    );

  return result ||
    null;
}

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value,
    )
    ? value as Record<string, unknown>
    : {};
}

function stringArray(
  value: unknown,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (entry) =>
            text(
              entry,
              160,
            ),
        )
        .filter(Boolean),
    ),
  );
}

function toDate(
  value: unknown,
) {
  if (
    !value
  ) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(
            value,
          ),
        );

  return Number.isFinite(
    date.getTime(),
  )
    ? date
    : null;
}

function checksum(
  content: string,
) {
  return createHash(
    'sha256',
  )
    .update(
      content,
      'utf8',
    )
    .digest(
      'hex',
    );
}

function catalogueEntry(
  rawKey: unknown,
) {
  const key =
    text(
      rawKey,
      160,
    ) as LegalDocumentKey;

  const entry =
    LEGAL_DOCUMENT_CATALOG_BY_KEY[
      key
    ];

  if (
    !entry
  ) {
    fail(
      'unknown_legal_document_key',
      400,
    );
  }

  return entry;
}

async function writeEvent(
  db: any,
  input: {
    orgId: string;
    documentId: string;
    versionId?: string | null;
    eventType: string;
    actor: LegalActor;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const event =
    await db.legalPublicationEvent.create({
      data: {
        orgId:
          input.orgId,
        documentId:
          input.documentId,
        versionId:
          input.versionId ||
          null,
        eventType:
          input.eventType,
        actorUserId:
          input.actor.userId,
        actorRole:
          input.actor.role,
        fromStatus:
          input.fromStatus ||
          null,
        toStatus:
          input.toStatus ||
          null,
        reason:
          input.reason ||
          null,
        metadata:
          input.metadata ||
          undefined,
      },
    });

  try {
    await db.auditEvent.create({
      data: {
        kind:
          'LEGAL_' +
          input.eventType,
        actorId:
          input.actor.userId,
        actorRole:
          input.actor.role,
        subjectId:
          input.versionId ||
          input.documentId,
        meta: {
          orgId:
            input.orgId,
          documentId:
            input.documentId,
          versionId:
            input.versionId ||
            null,
          fromStatus:
            input.fromStatus ||
            null,
          toStatus:
            input.toStatus ||
            null,
          reason:
            input.reason ||
            null,
        },
      },
    });
  } catch {
    // The dedicated LegalPublicationEvent remains authoritative.
  }

  return event;
}

async function findDocument(
  db: any,
  orgId: string,
  body: Record<string, unknown>,
) {
  const documentId =
    text(
      body.documentId,
      200,
    );

  const key =
    text(
      body.key ||
      body.documentKey,
      160,
    );

  const document =
    documentId
      ? await db.legalDocument.findFirst({
          where: {
            id:
              documentId,
            orgId,
          },
        })
      : key
        ? await db.legalDocument.findUnique({
            where: {
              orgId_key: {
                orgId,
                key,
              },
            },
          })
        : null;

  if (
    !document
  ) {
    fail(
      'legal_document_not_found',
      404,
    );
  }

  return document;
}

async function findVersion(
  db: any,
  orgId: string,
  body: Record<string, unknown>,
) {
  const versionId =
    text(
      body.versionId ||
      body.legalDocumentVersionId,
      200,
    );

  if (
    !versionId
  ) {
    fail(
      'legal_document_version_required',
      400,
    );
  }

  const version =
    await db.legalDocumentVersion.findFirst({
      where: {
        id:
          versionId,
        orgId,
      },
      include: {
        document:
          true,
      },
    });

  if (
    !version
  ) {
    fail(
      'legal_document_version_not_found',
      404,
    );
  }

  return version;
}

async function publishVersion(
  db: any,
  input: {
    orgId: string;
    actor: LegalActor;
    version: any;
    reason?: string | null;
    allowFuture?: boolean;
  },
) {
  const now =
    new Date();

  const version =
    input.version;

  if (
    ![
      'APPROVED',
      'SCHEDULED',
    ].includes(
      String(
        version.status,
      ),
    )
  ) {
    fail(
      'only_approved_or_scheduled_versions_can_be_published',
      409,
    );
  }

  const effectiveAt =
    version.effectiveAt
      ? new Date(
          version.effectiveAt,
        )
      : now;

  if (
    !input.allowFuture &&
    effectiveAt.getTime() >
      now.getTime()
  ) {
    fail(
      'scheduled_effective_time_has_not_arrived',
      409,
    );
  }

  const document =
    await db.legalDocument.findFirst({
      where: {
        id:
          version.documentId,
        orgId:
          input.orgId,
      },
      include: {
        currentPublishedVersion:
          true,
      },
    });

  if (
    !document
  ) {
    fail(
      'legal_document_not_found',
      404,
    );
  }

  const previous =
    document.currentPublishedVersion;

  if (
    previous &&
    previous.id !==
      version.id
  ) {
    await db.legalDocumentVersion.update({
      where: {
        id:
          previous.id,
      },
      data: {
        status:
          'SUPERSEDED',
        supersededAt:
          now,
        supersededByUserId:
          input.actor.userId,
        supersededByVersionId:
          version.id,
      },
    });

    await writeEvent(
      db,
      {
        orgId:
          input.orgId,
        documentId:
          document.id,
        versionId:
          previous.id,
        eventType:
          'SUPERSEDED',
        actor:
          input.actor,
        fromStatus:
          String(
            previous.status,
          ),
        toStatus:
          'SUPERSEDED',
        reason:
          input.reason ||
          'Superseded by a newly published version.',
        metadata: {
          supersededByVersionId:
            version.id,
        },
      },
    );
  }

  const published =
    await db.legalDocumentVersion.update({
      where: {
        id:
          version.id,
      },
      data: {
        status:
          'PUBLISHED',
        effectiveAt,
        publishedAt:
          now,
        publishedByUserId:
          input.actor.userId,
      },
    });

  await db.legalDocument.update({
    where: {
      id:
        document.id,
    },
    data: {
      status:
        'ACTIVE',
      currentPublishedVersionId:
        published.id,
    },
  });

  await writeEvent(
    db,
    {
      orgId:
        input.orgId,
      documentId:
        document.id,
      versionId:
        published.id,
      eventType:
        'PUBLISHED',
      actor:
        input.actor,
      fromStatus:
        String(
          version.status,
        ),
      toStatus:
        'PUBLISHED',
      reason:
        input.reason ||
        null,
      metadata: {
        effectiveAt:
          effectiveAt.toISOString(),
        previousPublishedVersionId:
          previous?.id ||
          null,
      },
    },
  );

  return published;
}

export async function listLegalDocuments(
  orgId: string,
  input: {
    key?: string | null;
    status?: string | null;
    includeEvents?: boolean;
    limit?: number;
  } = {},
) {
  const limit =
    Math.min(
      200,
      Math.max(
        1,
        Number(
          input.limit ||
          100,
        ),
      ),
    );

  return (
    prisma as any
  ).legalDocument.findMany({
    where: {
      orgId,
      ...(input.key
        ? {
            key:
              input.key,
          }
        : {}),
      ...(input.status
        ? {
            status:
              input.status,
          }
        : {}),
    },
    include: {
      currentPublishedVersion:
        true,
      versions: {
        orderBy: {
          versionNumber:
            'desc',
        },
        take:
          50,
      },
      ...(input.includeEvents
        ? {
            publicationEvents: {
              orderBy: {
                createdAt:
                  'desc',
              },
              take:
                100,
            },
          }
        : {}),
    },
    orderBy: {
      updatedAt:
        'desc',
    },
    take:
      limit,
  });
}

export async function runLegalAdminAction(
  input: AdminActionInput,
) {
  const action =
    text(
      input.action,
      100,
    ).toLowerCase();

  const body =
    objectValue(
      input.body,
    );

  if (
    !action
  ) {
    fail(
      'legal_action_required',
      400,
    );
  }

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const db =
        transaction as any;

      if (
        action ===
        'create_document'
      ) {
        const entry =
          catalogueEntry(
            body.key,
          );

        const existing =
          await db.legalDocument.findUnique({
            where: {
              orgId_key: {
                orgId:
                  input.orgId,
                key:
                  entry.key,
              },
            },
            include: {
              versions:
                true,
              currentPublishedVersion:
                true,
            },
          });

        if (
          existing
        ) {
          return {
            created:
              false,
            document:
              existing,
          };
        }

        const document =
          await db.legalDocument.create({
            data: {
              orgId:
                input.orgId,
              key:
                entry.key,
              title:
                text(
                  body.title,
                  300,
                ) ||
                entry.title,
              category:
                text(
                  body.category,
                  120,
                ) ||
                entry.category,
              ownerDepartment:
                text(
                  body.ownerDepartment,
                  120,
                ) ||
                'legal',
              acknowledgementMode:
                text(
                  body.acknowledgementMode,
                  40,
                ) ||
                entry.acknowledgementMode,
              audiences:
                stringArray(
                  body.audiences,
                ).length
                  ? stringArray(
                      body.audiences,
                    )
                  : [
                      ...entry.audiences,
                    ],
              applications:
                stringArray(
                  body.applications,
                ).length
                  ? stringArray(
                      body.applications,
                    )
                  : [
                      ...entry.applications,
                    ],
              surfaces:
                stringArray(
                  body.surfaces,
                ).length
                  ? stringArray(
                      body.surfaces,
                    )
                  : [
                      ...entry.surfaces,
                    ],
              metadata:
                objectValue(
                  body.metadata,
                ),
              createdByUserId:
                input.actor.userId,
            },
          });

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              document.id,
            eventType:
              'DOCUMENT_CREATED',
            actor:
              input.actor,
            toStatus:
              'ACTIVE',
            metadata: {
              key:
                document.key,
            },
          },
        );

        return {
          created:
            true,
          document,
        };
      }

      if (
        action ===
        'update_document'
      ) {
        const document =
          await findDocument(
            db,
            input.orgId,
            body,
          );

        const status =
          text(
            body.status,
            40,
          ).toUpperCase();

        if (
          status &&
          ![
            'ACTIVE',
            'ARCHIVED',
          ].includes(
            status,
          )
        ) {
          fail(
            'invalid_legal_document_status',
            400,
          );
        }

        const updated =
          await db.legalDocument.update({
            where: {
              id:
                document.id,
            },
            data: {
              ...(body.title !==
              undefined
                ? {
                    title:
                      text(
                        body.title,
                        300,
                      ),
                  }
                : {}),
              ...(body.category !==
              undefined
                ? {
                    category:
                      text(
                        body.category,
                        120,
                      ),
                  }
                : {}),
              ...(body.ownerDepartment !==
              undefined
                ? {
                    ownerDepartment:
                      text(
                        body.ownerDepartment,
                        120,
                      ),
                  }
                : {}),
              ...(body.acknowledgementMode !==
              undefined
                ? {
                    acknowledgementMode:
                      text(
                        body.acknowledgementMode,
                        40,
                      ),
                  }
                : {}),
              ...(body.audiences !==
              undefined
                ? {
                    audiences:
                      stringArray(
                        body.audiences,
                      ),
                  }
                : {}),
              ...(body.applications !==
              undefined
                ? {
                    applications:
                      stringArray(
                        body.applications,
                      ),
                  }
                : {}),
              ...(body.surfaces !==
              undefined
                ? {
                    surfaces:
                      stringArray(
                        body.surfaces,
                      ),
                  }
                : {}),
              ...(body.metadata !==
              undefined
                ? {
                    metadata:
                      objectValue(
                        body.metadata,
                      ),
                  }
                : {}),
              ...(status
                ? {
                    status,
                  }
                : {}),
            },
          });

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              document.id,
            eventType:
              'DOCUMENT_UPDATED',
            actor:
              input.actor,
            metadata: {
              changedFields:
                Object.keys(
                  body,
                ),
            },
          },
        );

        return {
          document:
            updated,
        };
      }

      if (
        action ===
        'create_version'
      ) {
        const document =
          await findDocument(
            db,
            input.orgId,
            body,
          );

        const content =
          text(
            body.content,
            1000000,
          );

        if (
          !content
        ) {
          fail(
            'legal_version_content_required',
            400,
          );
        }

        const contentChecksum =
          checksum(
            content,
          );

        const duplicate =
          await db.legalDocumentVersion.findFirst({
            where: {
              documentId:
                document.id,
              checksum:
                contentChecksum,
            },
          });

        if (
          duplicate
        ) {
          return {
            created:
              false,
            version:
              duplicate,
          };
        }

        const latest =
          await db.legalDocumentVersion.findFirst({
            where: {
              documentId:
                document.id,
            },
            orderBy: {
              versionNumber:
                'desc',
            },
          });

        const version =
          await db.legalDocumentVersion.create({
            data: {
              orgId:
                input.orgId,
              documentId:
                document.id,
              versionNumber:
                Number(
                  latest?.versionNumber ||
                  0,
                ) +
                1,
              versionLabel:
                nullableText(
                  body.versionLabel,
                  120,
                ),
              locale:
                text(
                  body.locale,
                  40,
                ) ||
                'en-ZA',
              contentFormat:
                text(
                  body.contentFormat,
                  40,
                ) ||
                'markdown',
              content,
              renderedHtml:
                nullableText(
                  body.renderedHtml,
                  1000000,
                ),
              checksum:
                contentChecksum,
              status:
                'DRAFT',
              changeSummary:
                nullableText(
                  body.changeSummary,
                  2000,
                ),
              authorUserId:
                input.actor.userId,
              metadata:
                objectValue(
                  body.metadata,
                ),
            },
          });

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              document.id,
            versionId:
              version.id,
            eventType:
              'VERSION_CREATED',
            actor:
              input.actor,
            toStatus:
              'DRAFT',
            metadata: {
              versionNumber:
                version.versionNumber,
              checksum:
                contentChecksum,
            },
          },
        );

        return {
          created:
            true,
          version,
        };
      }

      if (
        action ===
        'update_version'
      ) {
        const version =
          await findVersion(
            db,
            input.orgId,
            body,
          );

        if (
          String(
            version.status,
          ) !==
          'DRAFT'
        ) {
          fail(
            'only_draft_versions_can_be_edited',
            409,
          );
        }

        const content =
          body.content ===
          undefined
            ? version.content
            : text(
                body.content,
                1000000,
              );

        if (
          !content
        ) {
          fail(
            'legal_version_content_required',
            400,
          );
        }

        const updated =
          await db.legalDocumentVersion.update({
            where: {
              id:
                version.id,
            },
            data: {
              content,
              checksum:
                checksum(
                  content,
                ),
              ...(body.versionLabel !==
              undefined
                ? {
                    versionLabel:
                      nullableText(
                        body.versionLabel,
                        120,
                      ),
                  }
                : {}),
              ...(body.locale !==
              undefined
                ? {
                    locale:
                      text(
                        body.locale,
                        40,
                      ) ||
                      'en-ZA',
                  }
                : {}),
              ...(body.contentFormat !==
              undefined
                ? {
                    contentFormat:
                      text(
                        body.contentFormat,
                        40,
                      ) ||
                      'markdown',
                  }
                : {}),
              ...(body.renderedHtml !==
              undefined
                ? {
                    renderedHtml:
                      nullableText(
                        body.renderedHtml,
                        1000000,
                      ),
                  }
                : {}),
              ...(body.changeSummary !==
              undefined
                ? {
                    changeSummary:
                      nullableText(
                        body.changeSummary,
                        2000,
                      ),
                  }
                : {}),
              ...(body.metadata !==
              undefined
                ? {
                    metadata:
                      objectValue(
                        body.metadata,
                      ),
                  }
                : {}),
            },
          });

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              version.documentId,
            versionId:
              version.id,
            eventType:
              'VERSION_UPDATED',
            actor:
              input.actor,
            fromStatus:
              'DRAFT',
            toStatus:
              'DRAFT',
            metadata: {
              checksum:
                updated.checksum,
            },
          },
        );

        return {
          version:
            updated,
        };
      }

      if (
        [
          'submit',
          'approve',
          'schedule',
        ].includes(
          action,
        )
      ) {
        const version =
          await findVersion(
            db,
            input.orgId,
            body,
          );

        const stateMap: Record<
          string,
          {
            from: string;
            to: string;
            event: string;
          }
        > = {
          submit: {
            from:
              'DRAFT',
            to:
              'IN_REVIEW',
            event:
              'SUBMITTED',
          },
          approve: {
            from:
              'IN_REVIEW',
            to:
              'APPROVED',
            event:
              'APPROVED',
          },
          schedule: {
            from:
              'APPROVED',
            to:
              'SCHEDULED',
            event:
              'SCHEDULED',
          },
        };

        const transition =
          stateMap[
            action
          ];

        if (
          String(
            version.status,
          ) !==
          transition.from
        ) {
          fail(
            'invalid_legal_version_transition',
            409,
          );
        }

        const effectiveAt =
          action ===
          'schedule'
            ? toDate(
                body.effectiveAt ||
                body.scheduledAt,
              )
            : null;

        if (
          action ===
            'schedule' &&
          (
            !effectiveAt ||
            effectiveAt.getTime() <=
              Date.now()
          )
        ) {
          fail(
            'future_effective_time_required',
            400,
          );
        }

        const now =
          new Date();

        const updated =
          await db.legalDocumentVersion.update({
            where: {
              id:
                version.id,
            },
            data: {
              status:
                transition.to,
              ...(action ===
              'submit'
                ? {
                    submittedAt:
                      now,
                    submittedByUserId:
                      input.actor.userId,
                  }
                : {}),
              ...(action ===
              'approve'
                ? {
                    approvedAt:
                      now,
                    approvedByUserId:
                      input.actor.userId,
                  }
                : {}),
              ...(action ===
              'schedule'
                ? {
                    scheduledAt:
                      effectiveAt,
                    scheduledByUserId:
                      input.actor.userId,
                    effectiveAt,
                  }
                : {}),
            },
          });

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              version.documentId,
            versionId:
              version.id,
            eventType:
              transition.event,
            actor:
              input.actor,
            fromStatus:
              transition.from,
            toStatus:
              transition.to,
            reason:
              nullableText(
                body.reason,
                2000,
              ),
            metadata:
              effectiveAt
                ? {
                    effectiveAt:
                      effectiveAt.toISOString(),
                  }
                : null,
          },
        );

        return {
          version:
            updated,
        };
      }

      if (
        action ===
        'publish'
      ) {
        const version =
          await findVersion(
            db,
            input.orgId,
            body,
          );

        return {
          version:
            await publishVersion(
              db,
              {
                orgId:
                  input.orgId,
                actor:
                  input.actor,
                version,
                reason:
                  nullableText(
                    body.reason,
                    2000,
                  ),
              },
            ),
        };
      }

      if (
        action ===
        'publish_due'
      ) {
        const due =
          await db.legalDocumentVersion.findMany({
            where: {
              orgId:
                input.orgId,
              status:
                'SCHEDULED',
              effectiveAt: {
                lte:
                  new Date(),
              },
            },
            orderBy: {
              effectiveAt:
                'asc',
            },
            take:
              100,
          });

        const published = [];

        for (
          const version of
          due
        ) {
          published.push(
            await publishVersion(
              db,
              {
                orgId:
                  input.orgId,
                actor:
                  input.actor,
                version,
                reason:
                  'Scheduled Legal publication became effective.',
              },
            ),
          );
        }

        return {
          count:
            published.length,
          versions:
            published,
        };
      }

      if (
        action ===
        'retire'
      ) {
        const version =
          await findVersion(
            db,
            input.orgId,
            body,
          );

        if (
          ![
            'APPROVED',
            'SCHEDULED',
            'PUBLISHED',
          ].includes(
            String(
              version.status,
            ),
          )
        ) {
          fail(
            'legal_version_cannot_be_retired_from_current_state',
            409,
          );
        }

        const now =
          new Date();

        const reason =
          text(
            body.reason,
            2000,
          );

        if (
          !reason
        ) {
          fail(
            'retirement_reason_required',
            400,
          );
        }

        const document =
          await db.legalDocument.findFirst({
            where: {
              id:
                version.documentId,
              orgId:
                input.orgId,
            },
          });

        if (
          !document
        ) {
          fail(
            'legal_document_not_found',
            404,
          );
        }

        const retired =
          await db.legalDocumentVersion.update({
            where: {
              id:
                version.id,
            },
            data: {
              status:
                'RETIRED',
              retiredAt:
                now,
              retiredByUserId:
                input.actor.userId,
              retirementReason:
                reason,
            },
          });

        if (
          document.currentPublishedVersionId ===
          version.id
        ) {
          await db.legalDocument.update({
            where: {
              id:
                document.id,
            },
            data: {
              currentPublishedVersionId:
                null,
            },
          });
        }

        await writeEvent(
          db,
          {
            orgId:
              input.orgId,
            documentId:
              version.documentId,
            versionId:
              version.id,
            eventType:
              'RETIRED',
            actor:
              input.actor,
            fromStatus:
              String(
                version.status,
              ),
            toStatus:
              'RETIRED',
            reason,
          },
        );

        return {
          version:
            retired,
        };
      }

      fail(
        'unsupported_legal_action',
        400,
      );
    },
    {
      timeout:
        30000,
    },
  );
}

export async function getPublishedLegalDocuments(
  input: {
    orgId: string;
    keys?: string[];
    application?: string | null;
    surface?: string | null;
    locale?: string | null;
  },
) {
  const documents =
    await (
      prisma as any
    ).legalDocument.findMany({
      where: {
        orgId:
          input.orgId,
        status:
          'ACTIVE',
        currentPublishedVersionId: {
          not:
            null,
        },
        ...(input.keys &&
        input.keys.length
          ? {
              key: {
                in:
                  input.keys,
              },
            }
          : {}),
      },
      include: {
        currentPublishedVersion:
          true,
      },
      orderBy: {
        key:
          'asc',
      },
    });

  const now =
    Date.now();

  return documents
    .filter(
      (
        document: any,
      ) => {
        const version =
          document.currentPublishedVersion;

        if (
          !version ||
          String(
            version.status,
          ) !==
            'PUBLISHED'
        ) {
          return false;
        }

        if (
          version.effectiveAt &&
          new Date(
            version.effectiveAt,
          ).getTime() >
            now
        ) {
          return false;
        }

        const applications =
          stringArray(
            document.applications,
          );

        const surfaces =
          stringArray(
            document.surfaces,
          );

        if (
          input.application &&
          !applications.includes(
            input.application,
          )
        ) {
          return false;
        }

        if (
          input.surface &&
          surfaces.length &&
          !surfaces.includes(
            input.surface,
          )
        ) {
          return false;
        }

        if (
          input.locale &&
          version.locale !==
            input.locale
        ) {
          return false;
        }

        return true;
      },
    )
    .map(
      (
        document: any,
      ) => {
        const version =
          document.currentPublishedVersion;

        return {
          documentId:
            document.id,
          key:
            document.key,
          title:
            document.title,
          category:
            document.category,
          acknowledgementMode:
            document.acknowledgementMode,
          audiences:
            document.audiences,
          applications:
            document.applications,
          surfaces:
            document.surfaces,
          version: {
            id:
              version.id,
            versionNumber:
              version.versionNumber,
            versionLabel:
              version.versionLabel,
            locale:
              version.locale,
            contentFormat:
              version.contentFormat,
            content:
              version.content,
            renderedHtml:
              version.renderedHtml,
            checksum:
              version.checksum,
            effectiveAt:
              version.effectiveAt,
            publishedAt:
              version.publishedAt,
          },
        };
      },
    );
}

export async function recordLegalAcknowledgement(
  input: AcknowledgementInput,
) {
  const application =
    text(
      input.application,
      120,
    );

  const subjectType =
    text(
      input.subjectType,
      80,
    );

  if (
    !application
  ) {
    fail(
      'acknowledgement_application_required',
      400,
    );
  }

  if (
    !subjectType
  ) {
    fail(
      'acknowledgement_subject_type_required',
      400,
    );
  }

  const action =
    text(
      input.action ||
      'ACCEPTED',
      40,
    ).toUpperCase();

  if (
    !ACKNOWLEDGEMENT_ACTIONS.includes(
      action as any,
    )
  ) {
    fail(
      'invalid_acknowledgement_action',
      400,
    );
  }

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const db =
        transaction as any;

      let version;

      if (
        input.legalDocumentVersionId
      ) {
        version =
          await db.legalDocumentVersion.findFirst({
            where: {
              id:
                input.legalDocumentVersionId,
              orgId:
                input.orgId,
            },
            include: {
              document:
                true,
            },
          });
      } else if (
        input.documentKey
      ) {
        const document =
          await db.legalDocument.findUnique({
            where: {
              orgId_key: {
                orgId:
                  input.orgId,
                key:
                  input.documentKey,
              },
            },
            include: {
              currentPublishedVersion:
                true,
            },
          });

        version =
          document?.currentPublishedVersion
            ? {
                ...document.currentPublishedVersion,
                document,
              }
            : null;
      }

      if (
        !version
      ) {
        fail(
          'published_legal_version_not_found',
          404,
        );
      }

      if (
        String(
          version.status,
        ) !==
        'PUBLISHED'
      ) {
        fail(
          'legal_version_is_not_published',
          409,
        );
      }

      if (
        version.effectiveAt &&
        new Date(
          version.effectiveAt,
        ).getTime() >
          Date.now()
      ) {
        fail(
          'legal_version_is_not_effective',
          409,
        );
      }

      const createData = {
        orgId:
          input.orgId,
        legalDocumentVersionId:
          version.id,
        documentKeySnapshot:
          version.document.key,
        versionLabelSnapshot:
          version.versionLabel,
        checksumSnapshot:
          version.checksum,
        subjectType,
        subjectUserId:
          nullableText(
            input.subjectUserId,
            200,
          ),
        subjectId:
          nullableText(
            input.subjectId,
            200,
          ),
        application,
        surface:
          nullableText(
            input.surface,
            160,
          ),
        action,
        locale:
          nullableText(
            input.locale,
            40,
          ),
        ipHash:
          nullableText(
            input.ipHash,
            128,
          ),
        userAgent:
          nullableText(
            input.userAgent,
            2000,
          ),
        evidence:
          input.evidence ||
          undefined,
        idempotencyKey:
          nullableText(
            input.idempotencyKey,
            300,
          ),
      };

      let acknowledgement;

      if (
        createData.idempotencyKey
      ) {
        acknowledgement =
          await db.legalAcknowledgement.upsert({
            where: {
              idempotencyKey:
                createData.idempotencyKey,
            },
            create:
              createData,
            update: {},
          });
      } else {
        acknowledgement =
          await db.legalAcknowledgement.create({
            data:
              createData,
          });
      }

      await writeEvent(
        db,
        {
          orgId:
            input.orgId,
          documentId:
            version.document.id,
          versionId:
            version.id,
          eventType:
            'ACKNOWLEDGED',
          actor: {
            userId:
              createData.subjectUserId,
            role:
              subjectType,
          },
          fromStatus:
            'PUBLISHED',
          toStatus:
            'PUBLISHED',
          metadata: {
            acknowledgementId:
              acknowledgement.id,
            action,
            application,
            surface:
              createData.surface,
          },
        },
      );

      return acknowledgement;
    },
    {
      timeout:
        30000,
    },
  );
}

export function hashLegalEvidenceIp(
  ip: string,
) {
  const salt =
    process.env.LEGAL_EVIDENCE_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'ambulant-legal-evidence';

  return createHash(
    'sha256',
  )
    .update(
      salt +
      ':' +
      ip,
      'utf8',
    )
    .digest(
      'hex',
    );
}

export function supportedLegalVersionStates() {
  return [
    ...VERSION_STATES,
  ];
}
