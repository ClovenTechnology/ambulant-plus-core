import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../../utils/auth';
import {
  resolveClinicianOnboardingEntitlements,
} from '@/src/clinicians/onboarding/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(
  value: unknown,
  max = 240,
): string | null {
  const text =
    String(value ?? '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function parseDateMaybe(
  value: unknown,
): Date | null {
  if (!value) return null;

  const date =
    new Date(String(value));

  return Number.isFinite(date.getTime())
    ? date
    : null;
}

function normaliseItemKind(
  value: unknown,
): string {
  const text =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    text.includes('device') ||
    text.includes('iomt') ||
    text.includes('monitor') ||
    text.includes('scope') ||
    text.includes('ring')
  ) {
    return 'device';
  }

  if (
    text.includes('shirt') ||
    text.includes('mug') ||
    text.includes('bottle') ||
    text.includes('lanyard')
  ) {
    return 'merch';
  }

  if (
    text.includes('handbook') ||
    text.includes('document') ||
    text.includes('card')
  ) {
    return 'paperwork';
  }

  return 'other';
}

function itemIdentity(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isPermanentDispatch(
  dispatch: any,
) {
  const status =
    String(dispatch?.status || '')
      .trim()
      .toLowerCase();

  if (
    status === 'canceled' ||
    status === 'cancelled'
  ) {
    return false;
  }

  const notes =
    String(dispatch?.notes || '')
      .trim()
      .toLowerCase();

  return !(
    notes.includes('temporary training') ||
    notes.includes('training loan') ||
    notes.includes('loaner training')
  );
}

function actorId(
  admin: any,
  request: NextRequest,
) {
  return (
    cleanStr(
      admin?.uid ||
      admin?.userId ||
      admin?.user?.id ||
      request.headers.get('x-uid'),
      120,
    ) ||
    'admin-dashboard'
  );
}

function requestIp(
  request: NextRequest,
) {
  return (
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

function json(
  body: any,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const admin =
      await verifyAdminRequest(request);

    if (
      admin === false ||
      (admin as any)?.ok === false
    ) {
      return (
        (admin as any)?.response ||
        json(
          {
            ok: false,
            error: 'admin_required',
          },
          403,
        )
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({} as any));

    const clinicianId =
      cleanStr(body.clinicianId, 120);

    const requestedOnboardingId =
      cleanStr(body.onboardingId, 120);

    if (!clinicianId) {
      return json(
        {
          ok: false,
          error: 'clinicianId_required',
        },
        400,
      );
    }

    const requestedDispatchKind =
      String(
        body.dispatchKind ||
        body.dispatchType ||
        body.kitType ||
        'starter_kit',
      )
        .trim()
        .toLowerCase();

    if (
      [
        'temporary_training_kit',
        'training_loan_kit',
        'loaner_training_kit',
        'temporary',
        'loaner',
      ].includes(requestedDispatchKind)
    ) {
      return json(
        {
          ok: false,
          error:
            'temporary_training_kit_not_configured',
          message:
            'Temporary or loan-kit fulfilment is not part of the active Admin-configured onboarding policy.',
        },
        409,
      );
    }

    const courier =
      cleanStr(
        body.courier ||
        body.courierName,
        120,
      );

    const trackingCode =
      cleanStr(
        body.trackingCode,
        120,
      );

    const trackingUrl =
      cleanStr(
        body.trackingUrl,
        1000,
      );

    const etaDate =
      parseDateMaybe(body.etaDate);

    const adminNote =
      cleanStr(body.notes, 1500);

    const ignoredClientSuppliedItems =
      Array.isArray(body.items) ||
      Array.isArray(body.kitItems);

    const result =
      await prisma.$transaction(
        async (tx: any) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(
                ${`clinician-starter-kit:${clinicianId}`}
              )
            )
          `;

          const onboarding =
            await tx.clinicianOnboarding
              .findUnique({
                where: {
                  clinicianId,
                },
              });

          if (!onboarding) {
            return {
              httpStatus: 404,
              error:
                'onboarding_not_found',
            };
          }

          if (
            requestedOnboardingId &&
            String(onboarding.id) !==
              requestedOnboardingId
          ) {
            return {
              httpStatus: 409,
              error:
                'onboarding_clinician_mismatch',
            };
          }

          const entitlements =
            await resolveClinicianOnboardingEntitlements(
              tx,
              clinicianId,
              onboarding,
            );

          if (
            entitlements.starterKitRelease ===
              'none' ||
            !entitlements.starterKitItems
              .length
          ) {
            return {
              httpStatus: 409,
              error:
                'starter_kit_release_not_authorised',
              message:
                'The effective Admin-configured payment pathway does not authorise a C-Med Kit dispatch.',
              entitlements,
            };
          }

          const existingDispatches =
            await tx.clinicianDispatch
              .findMany({
                where: {
                  clinicianId,
                  onboardingId:
                    onboarding.id,
                },
                include: {
                  items: true,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              });

          const permanentDispatches =
            existingDispatches.filter(
              isPermanentDispatch,
            );

          const alreadyReleased =
            new Set<string>();

          for (
            const dispatch of
            permanentDispatches
          ) {
            for (
              const item of
              Array.isArray(dispatch.items)
                ? dispatch.items
                : []
            ) {
              const identity =
                itemIdentity(item?.label);

              if (identity) {
                alreadyReleased.add(
                  identity,
                );
              }
            }
          }

          const missingItems =
            entitlements.starterKitItems
              .filter(
                (label: string) =>
                  !alreadyReleased.has(
                    itemIdentity(label),
                  ),
              );

          if (!missingItems.length) {
            const existing =
              permanentDispatches[0] ||
              null;

            let dispatch = existing;

            if (existing) {
              const updateData:
                Record<string, any> = {};

              if (courier) {
                updateData.courier =
                  courier;
              }

              if (trackingCode) {
                updateData.trackingCode =
                  trackingCode;
              }

              if (trackingUrl) {
                updateData.trackingUrl =
                  trackingUrl;
              }

              if (etaDate) {
                updateData.etaDate =
                  etaDate;
              }

              if (
                Object.keys(updateData)
                  .length
              ) {
                dispatch =
                  await tx.clinicianDispatch
                    .update({
                      where: {
                        id: existing.id,
                      },
                      data: updateData,
                      include: {
                        items: true,
                      },
                    });
              }
            }

            return {
              httpStatus: 200,
              ok: true,
              alreadySatisfied: true,
              dispatch,
              entitlements,
              missingItems: [],
            };
          }

          const dispatch =
            await tx.clinicianDispatch
              .create({
                data: {
                  onboardingId:
                    onboarding.id,
                  clinicianId,
                  courier:
                    courier ||
                    'Pending admin assignment',
                  trackingCode:
                    trackingCode ||
                    'Pending',
                  trackingUrl:
                    trackingUrl || null,
                  etaDate:
                    etaDate || null,
                  status: 'prepared',
                  notes: [
                    'Server-authorised onboarding kit release.',
                    `Commercial pathway: ${entitlements.pathwayKey}.`,
                    `Release level: ${entitlements.starterKitRelease}.`,
                    adminNote,
                  ]
                    .filter(Boolean)
                    .join(' '),
                  items: {
                    create:
                      missingItems.map(
                        (
                          label: string,
                          index: number,
                        ) => ({
                          kind:
                            normaliseItemKind(
                              label,
                            ),
                          label,
                          quantity: 1,
                          deviceId: null,
                          isMandatory: true,
                          isShipped: false,
                          sku:
                            label
                              .toUpperCase()
                              .replace(
                                /[^A-Z0-9]+/g,
                                '-',
                              )
                              .replace(
                                /^-+|-+$/g,
                                '',
                              )
                              .slice(0, 64) ||
                            `CMED-${index + 1}`,
                        }),
                      ),
                  },
                },
                include: {
                  items: true,
                },
              });

          await tx.clinicianOnboarding
            .update({
              where: {
                id: onboarding.id,
              },
              data: {
                trainingNotes: [
                  cleanStr(
                    onboarding.trainingNotes,
                    4000,
                  ),
                  [
                    'Permanent C-Med release prepared',
                    new Date()
                      .toISOString(),
                    `pathway=${entitlements.pathwayKey}`,
                    `release=${entitlements.starterKitRelease}`,
                    `items=${missingItems.length}`,
                  ].join(' | '),
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            });

          return {
            httpStatus: 201,
            ok: true,
            alreadySatisfied: false,
            dispatch,
            entitlements,
            missingItems,
          };
        },
      );

    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.error,
          message:
            (result as any).message,
          entitlements:
            (result as any)
              .entitlements || null,
        },
        result.httpStatus || 409,
      );
    }

    const adminUid =
      actorId(admin, request);

    await prisma.auditLog
      .create({
        data: {
          actorUserId: adminUid,
          actorType: 'ADMIN',
          actorRefId: adminUid,
          app: 'admin-dashboard',
          action:
            result.alreadySatisfied
              ? 'clinician_starter_kit.release_confirmed'
              : 'clinician_starter_kit.dispatch_created',
          entityType:
            'ClinicianDispatch',
          entityId:
            result.dispatch?.id ||
            clinicianId,
          description:
            result.alreadySatisfied
              ? 'Admin confirmed an existing server-authorised C-Med Kit release.'
              : 'Admin created a server-authorised C-Med Kit dispatch.',
          ip: requestIp(request),
          userAgent:
            cleanStr(
              request.headers
                .get('user-agent'),
              1000,
            ),
          meta: {
            clinicianId,
            onboardingId:
              result.dispatch
                ?.onboardingId ||
              requestedOnboardingId,
            commercialPathway:
              result.entitlements
                .pathwayKey,
            starterKitRelease:
              result.entitlements
                .starterKitRelease,
            authorisedItems:
              result.entitlements
                .starterKitItems,
            newlyReleasedItems:
              result.missingItems,
            ignoredClientSuppliedItems,
          },
        },
      })
      .catch((error: any) => {
        console.warn(
          '[create-dispatch] audit failed',
          error,
        );
      });

    return json(
      {
        ok: true,
        alreadySatisfied:
          result.alreadySatisfied,
        dispatch: result.dispatch,
        entitlements: {
          pathwayKey:
            result.entitlements
              .pathwayKey,
          privileges:
            result.entitlements
              .privileges,
          starterKitRelease:
            result.entitlements
              .starterKitRelease,
          authorisedItems:
            result.entitlements
              .starterKitItems,
          newlyReleasedItems:
            result.missingItems,
        },
        ignoredClientSuppliedItems,
        notificationRequested:
          body.notifyClinician === true,
      },
      result.httpStatus,
    );
  }
  catch (error: any) {
    console.error(
      '[api-gateway][admin][onboarding][create-dispatch] error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          String(
            error?.message ||
            'create_dispatch_failed',
          ),
      },
      500,
    );
  }
}
