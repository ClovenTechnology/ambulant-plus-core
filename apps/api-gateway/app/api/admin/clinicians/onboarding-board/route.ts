import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  verifyAdminRequest,
} from '../../utils/auth';
import {
  getClinicianOnboardingSettings,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import {
  adminClinicianPayLaterRequest,
} from '@/src/clinicians/onboarding/pay-later';
import {
  resolveClinicianOnboardingEntitlementsFromEvidence,
  resolvePermanentStarterKitFulfilment,
} from '@/src/clinicians/onboarding/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UiStage =
  | 'applied'
  | 'screened'
  | 'approved'
  | 'rejected'
  | 'training_scheduled'
  | 'training_completed';

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

function asIso(
  value: unknown,
): string | null {
  if (!value) return null;

  const date =
    new Date(String(value));

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toISOString()
    : null;
}

function outwardStage(
  status: unknown,
): UiStage {
  const value =
    String(status ?? '')
      .trim()
      .toLowerCase();

  if (value === 'screened') {
    return 'screened';
  }

  if (value === 'approved') {
    return 'approved';
  }

  if (value === 'rejected') {
    return 'rejected';
  }

  if (
    value === 'training_scheduled'
  ) {
    return 'training_scheduled';
  }

  if (
    value === 'training_completed'
  ) {
    return 'training_completed';
  }

  return 'applied';
}

function outwardTrainingStatus(
  status: unknown,
):
  | 'scheduled'
  | 'completed'
  | 'canceled' {
  const value =
    String(status ?? '')
      .trim()
      .toLowerCase();

  if (value === 'completed') {
    return 'completed';
  }

  if (
    value === 'canceled' ||
    value === 'cancelled'
  ) {
    return 'canceled';
  }

  return 'scheduled';
}

function outwardDispatchStatus(
  status: unknown,
):
  | 'pending'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'canceled' {
  const value =
    String(status ?? '')
      .trim()
      .toLowerCase();

  if (value === 'packed') {
    return 'packed';
  }

  if (value === 'shipped') {
    return 'shipped';
  }

  if (value === 'delivered') {
    return 'delivered';
  }

  if (
    value === 'canceled' ||
    value === 'cancelled'
  ) {
    return 'canceled';
  }

  return 'pending';
}

function publicEntitlements(
  entitlements: any,
  fulfilment: any,
) {
  return {
    resolvedAt:
      entitlements.resolvedAt,
    pathwayKey:
      entitlements.pathwayKey,
    pathwayLabel:
      entitlements.pathwayLabel,
    approvedPayLater:
      entitlements.approvedPayLater,
    depositQualified:
      entitlements.depositQualified,
    privileges:
      entitlements.privileges,
    trainingAccess:
      entitlements.trainingAccess,
    practiceActivation:
      entitlements.practiceActivation,
    starterKitRelease:
      entitlements.starterKitRelease,
    authorisedStarterKitItems:
      fulfilment.authorisedItems,
    releasedStarterKitItems:
      fulfilment.releasedItems,
    missingStarterKitItems:
      fulfilment.missingItems,
    starterKitReleaseSatisfied:
      fulfilment.releaseSatisfied,
    platformIndemnityEligible:
      entitlements
        .platformIndemnityEligible,
    balanceRecoveryApplies:
      entitlements
        .balanceRecoveryApplies,
    outstandingCents:
      entitlements.outstandingCents,
    conditions:
      entitlements.conditions,
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

    const db: any = prisma;

    const clinicians =
      await db.clinicianProfile
        .findMany({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            specialty: true,
            createdAt: true,
            status: true,
            trainingCompleted: true,
            archived: true,
          },
        });

    const visibleClinicians =
      Array.isArray(clinicians)
        ? clinicians.filter(
            (clinician: any) =>
              !clinician?.archived,
          )
        : [];

    const clinicianIds =
      visibleClinicians.map(
        (clinician: any) =>
          String(clinician.id),
      );

    const onboardings =
      clinicianIds.length
        ? await db
            .clinicianOnboarding
            .findMany({
              where: {
                clinicianId: {
                  in: clinicianIds,
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            })
        : [];

    const onboardingByClinicianId =
      new Map<string, any>();

    for (
      const onboarding of
      onboardings || []
    ) {
      const clinicianId =
        String(
          onboarding.clinicianId,
        );

      if (
        !onboardingByClinicianId.has(
          clinicianId,
        )
      ) {
        onboardingByClinicianId.set(
          clinicianId,
          onboarding,
        );
      }
    }

    const trainingSlotIds =
      Array.from(
        new Set(
          (onboardings || [])
            .map(
              (onboarding: any) =>
                cleanStr(
                  onboarding
                    .trainingSlotId,
                  120,
                ),
            )
            .filter(Boolean),
        ),
      ) as string[];

    const trainingSlots =
      trainingSlotIds.length
        ? await db
            .clinicianTrainingSlot
            .findMany({
              where: {
                id: {
                  in:
                    trainingSlotIds,
                },
              },
            })
        : [];

    const trainingSlotById =
      new Map<string, any>();

    for (
      const training of
      trainingSlots || []
    ) {
      trainingSlotById.set(
        String(training.id),
        training,
      );
    }

    const dispatches =
      clinicianIds.length
        ? await db
            .clinicianDispatch
            .findMany({
              where: {
                clinicianId: {
                  in: clinicianIds,
                },
              },
              include: {
                items: true,
              },
              orderBy: [
                {
                  createdAt: 'desc',
                },
              ],
            })
        : [];

    const payments =
      clinicianIds.length
        ? await db
            .clinicianOnboardingPayment
            .findMany({
              where: {
                clinicianId: {
                  in: clinicianIds,
                },
                status: {
                  in: [
                    'confirmed',
                    'paid',
                    'captured',
                    'redeemed',
                  ],
                },
              },
              orderBy: [
                {
                  confirmedAt: 'desc',
                },
                {
                  createdAt: 'desc',
                },
              ],
            })
        : [];

    const pendingProofPayments =
      clinicianIds.length
        ? await db
            .clinicianOnboardingPayment
            .findMany({
              where: {
                clinicianId: {
                  in: clinicianIds,
                },
                status: 'pending',
                provider: {
                  in: [
                    'eft',
                    'manual',
                  ],
                },
                proofOfPaymentUrl: {
                  not: null,
                },
              },
              orderBy: [
                {
                  updatedAt: 'desc',
                },
                {
                  createdAt: 'desc',
                },
              ],
            })
        : [];

    let payLaterRequests: any[] =
      [];

    if (clinicianIds.length) {
      try {
        payLaterRequests =
          await db
            .clinicianOnboardingPayLaterRequest
            .findMany({
              where: {
                clinicianId: {
                  in: clinicianIds,
                },
              },
              orderBy: [
                {
                  requestedAt: 'desc',
                },
                {
                  createdAt: 'desc',
                },
              ],
            });
      }
      catch (error: any) {
        const code =
          String(
            error?.code || '',
          );

        if (
          code !== 'P2021' &&
          code !== 'P2022'
        ) {
          throw error;
        }
      }
    }

    const paymentsByClinicianId =
      new Map<string, any[]>();

    for (
      const payment of
      payments || []
    ) {
      const clinicianId =
        String(payment.clinicianId);

      const existing =
        paymentsByClinicianId.get(
          clinicianId,
        ) || [];

      existing.push(payment);

      paymentsByClinicianId.set(
        clinicianId,
        existing,
      );
    }

    const latestPendingProofByClinicianId =
      new Map<string, any>();

    for (
      const payment of
      pendingProofPayments || []
    ) {
      const clinicianId =
        String(payment.clinicianId);

      if (
        !latestPendingProofByClinicianId
          .has(clinicianId)
      ) {
        latestPendingProofByClinicianId
          .set(
            clinicianId,
            payment,
          );
      }
    }

    const dispatchesByClinicianId =
      new Map<string, any[]>();

    for (
      const dispatch of
      dispatches || []
    ) {
      const clinicianId =
        String(dispatch.clinicianId);

      const existing =
        dispatchesByClinicianId.get(
          clinicianId,
        ) || [];

      existing.push(dispatch);

      dispatchesByClinicianId.set(
        clinicianId,
        existing,
      );
    }

    const latestPayLaterByClinicianId =
      new Map<string, any>();

    const latestApprovedPayLaterByClinicianId =
      new Map<string, any>();

    for (
      const payLaterRequest of
      payLaterRequests || []
    ) {
      const clinicianId =
        String(
          payLaterRequest
            .clinicianId,
        );

      if (
        !latestPayLaterByClinicianId
          .has(clinicianId)
      ) {
        latestPayLaterByClinicianId
          .set(
            clinicianId,
            payLaterRequest,
          );
      }

      if (
        String(
          payLaterRequest.status ||
          '',
        )
          .trim()
          .toLowerCase() ===
          'approved' &&
        !latestApprovedPayLaterByClinicianId
          .has(clinicianId)
      ) {
        latestApprovedPayLaterByClinicianId
          .set(
            clinicianId,
            payLaterRequest,
          );
      }
    }

    const settings =
      await getClinicianOnboardingSettings();

    const publicSettings =
      publicClinicianOnboardingSettings(
        settings,
      );

    const rows =
      visibleClinicians.map(
        (clinician: any) => {
          const clinicianId =
            String(clinician.id);

          const onboarding =
            onboardingByClinicianId
              .get(clinicianId) ||
            null;

          const training =
            onboarding?.trainingSlotId
              ? trainingSlotById
                  .get(
                    String(
                      onboarding
                        .trainingSlotId,
                    ),
                  ) || null
              : null;

          const clinicianDispatches =
            dispatchesByClinicianId
              .get(clinicianId) ||
            [];

          const dispatch =
            clinicianDispatches[0] ||
            null;

          const confirmedPayments =
            paymentsByClinicianId
              .get(clinicianId) ||
            [];

          const pendingProofPayment =
            latestPendingProofByClinicianId
              .get(clinicianId) ||
            null;

          const pendingPaymentMeta =
            pendingProofPayment?.meta &&
            typeof pendingProofPayment.meta ===
              'object' &&
            !Array.isArray(
              pendingProofPayment.meta,
            )
              ? pendingProofPayment.meta
              : {};

          const pendingProofMeta =
            pendingPaymentMeta
              ?.proofOfPayment &&
            typeof pendingPaymentMeta
              .proofOfPayment ===
              'object' &&
            !Array.isArray(
              pendingPaymentMeta
                .proofOfPayment,
            )
              ? pendingPaymentMeta
                  .proofOfPayment
              : {};

          const latestPayLaterRequest =
            latestPayLaterByClinicianId
              .get(clinicianId) ||
            null;

          const latestApprovedPayLater =
            latestApprovedPayLaterByClinicianId
              .get(clinicianId) ||
            null;

          const entitlements =
            resolveClinicianOnboardingEntitlementsFromEvidence(
              {
                settings,
                onboarding,
                payments:
                  confirmedPayments,
                latestApprovedPayLater,
              },
            );

          const fulfilment =
            resolvePermanentStarterKitFulfilment(
              entitlements,
              clinicianDispatches,
            );

          const paymentState =
            entitlements
              .paymentState;

          const paymentPlan =
            cleanStr(
              onboarding
                ?.paymentPlan,
              120,
            );

          const payLaterPathwayActive =
            entitlements
              .pathwayKey ===
            'START_NOW_PAY_LATER';

          const latestPayment =
            confirmedPayments[0] ||
            null;

          return {
            clinicianId,
            displayName:
              cleanStr(
                clinician
                  .displayName,
                240,
              ) ||
              'Clinician',
            email:
              cleanStr(
                clinician.email,
                320,
              ),
            phone:
              cleanStr(
                clinician.phone,
                80,
              ),
            specialty:
              cleanStr(
                clinician
                  .specialty,
                240,
              ),
            createdAt:
              asIso(
                clinician.createdAt,
              ) ||
              new Date()
                .toISOString(),
            onboarding: {
              id:
                onboarding?.id
                  ? String(
                      onboarding.id,
                    )
                  : `virtual-onboarding-${clinicianId}`,
              stage:
                outwardStage(
                  onboarding
                    ?.status,
                ),
              notes:
                cleanStr(
                  onboarding
                    ?.trainingNotes,
                  2000,
                ),
              depositPaid:
                entitlements
                  .depositQualified,
              paymentPlan,
              nextPaymentAt:
                asIso(
                  onboarding
                    ?.nextPaymentAt,
                ),
              waiverActive:
                payLaterPathwayActive,
            },
            payment: {
              amountPaidCents:
                paymentState
                  .amountPaidCents,
              outstandingCents:
                paymentState
                  .outstandingCents,
              initialRequirementMet:
                paymentState
                  .initialRequirementMet,
              fullyPaid:
                paymentState
                  .fullyPaid,
              paymentStatus:
                payLaterPathwayActive
                  ? 'waiver'
                  : paymentState
                      .paymentStatus,
              waiverActive:
                payLaterPathwayActive,
              pendingProofOfPayment:
                pendingProofPayment
                  ? {
                      id:
                        String(
                          pendingProofPayment.id,
                        ),
                      provider:
                        cleanStr(
                          pendingProofPayment
                            .provider,
                          80,
                        ),
                      status:
                        cleanStr(
                          pendingProofPayment
                            .status,
                          80,
                        ),
                      amountCents:
                        Math.max(
                          0,
                          Math.round(
                            Number(
                              pendingProofPayment
                                .amountCents ||
                              0,
                            ),
                          ),
                        ),
                      currency:
                        cleanStr(
                          pendingProofPayment
                            .currency,
                          8,
                        ),
                      submittedAt:
                        asIso(
                          pendingProofMeta
                            .uploadedAt ||
                          pendingProofPayment
                            .updatedAt ||
                          pendingProofPayment
                            .createdAt,
                        ),
                      filename:
                        cleanStr(
                          pendingProofMeta
                            .filename,
                          240,
                        ),
                      mimeType:
                        cleanStr(
                          pendingProofMeta
                            .mimeType,
                          120,
                        ),
                      sizeBytes:
                        Number.isFinite(
                          Number(
                            pendingProofMeta
                              .sizeBytes,
                          ),
                        )
                          ? Math.max(
                              0,
                              Math.round(
                                Number(
                                  pendingProofMeta
                                    .sizeBytes,
                                ),
                              ),
                            )
                          : null,
                      pathwayKey:
                        cleanStr(
                          pendingPaymentMeta
                            .pathwayKey,
                          80,
                        ),
                      trainingMode:
                        cleanStr(
                          pendingPaymentMeta
                            .trainingMode,
                          40,
                        ),
                    }
                  : null,
              latestConfirmedPayment:
                latestPayment
                  ? {
                      id:
                        String(
                          latestPayment.id,
                        ),
                      provider:
                        cleanStr(
                          latestPayment
                            .provider,
                          80,
                        ),
                      status:
                        cleanStr(
                          latestPayment
                            .status,
                          80,
                        ),
                      amountCents:
                        Math.max(
                          0,
                          Math.round(
                            Number(
                              latestPayment
                                .amountCents ||
                              0,
                            ),
                          ),
                        ),
                      currency:
                        cleanStr(
                          latestPayment
                            .currency,
                          8,
                        ),
                      paymentReference:
                        cleanStr(
                          latestPayment
                            .paymentReference,
                          180,
                        ),
                      proofOfPaymentAttached:
                        Boolean(
                          latestPayment
                            .proofOfPaymentUrl,
                        ),
                      authorisationCodeHint:
                        cleanStr(
                          latestPayment
                            .authorisationCodeHint,
                          20,
                        ),
                      authorisationExpiresAt:
                        asIso(
                          latestPayment
                            .authorisationExpiresAt,
                        ),
                      confirmedAt:
                        asIso(
                          latestPayment
                            .confirmedAt,
                        ),
                    }
                  : null,
            },
            payLaterRequest:
              adminClinicianPayLaterRequest(
                latestPayLaterRequest,
              ),
            entitlements:
              publicEntitlements(
                entitlements,
                fulfilment,
              ),
            trainingSlot:
              training
                ? {
                    id:
                      String(
                        training.id,
                      ),
                    startAt:
                      asIso(
                        training
                          .startsAt,
                      ),
                    endAt:
                      asIso(
                        training
                          .endsAt,
                      ),
                    mode:
                      String(
                        training
                          .mode ||
                        '',
                      )
                        .trim()
                        .toLowerCase() ===
                      'in_person'
                        ? 'in_person'
                        : 'virtual',
                    status:
                      outwardTrainingStatus(
                        training
                          .status,
                      ),
                    joinUrl:
                      cleanStr(
                        training
                          .meetingUrl,
                        1000,
                      ),
                  }
                : null,
            dispatch:
              dispatch
                ? {
                    id:
                      String(
                        dispatch.id,
                      ),
                    status:
                      outwardDispatchStatus(
                        dispatch
                          .status,
                      ),
                    courierName:
                      cleanStr(
                        dispatch
                          .courier,
                        240,
                      ),
                    trackingCode:
                      cleanStr(
                        dispatch
                          .trackingCode,
                        240,
                      ),
                    shippedAt:
                      asIso(
                        dispatch
                          .shippedAt,
                      ),
                    deliveredAt:
                      asIso(
                        dispatch
                          .deliveredAt,
                      ),
                    items:
                      Array.isArray(
                        dispatch.items,
                      )
                        ? dispatch
                            .items
                            .map(
                              (
                                item: any,
                              ) => ({
                                label:
                                  cleanStr(
                                    item
                                      ?.label,
                                    240,
                                  ),
                                quantity:
                                  Math.max(
                                    1,
                                    Math.round(
                                      Number(
                                        item
                                          ?.quantity ||
                                        1,
                                      ),
                                    ),
                                  ),
                                shipped:
                                  item
                                    ?.isShipped ===
                                  true,
                              }),
                            )
                        : [],
                  }
                : null,
          };
        },
      );

    return NextResponse.json(
      {
        ok: true,
        rows,
        settings: {
          publicSettings,
        },
      },
      {
        headers: {
          'cache-control':
            'no-store',
          'access-control-allow-origin':
            '*',
        },
      },
    );
  }
  catch (error: any) {
    console.error(
      '[api-gateway][admin][clinicians][onboarding-board] error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          String(
            error?.message ||
            'onboarding_board_failed',
          ),
      },
      {
        status: 500,
      },
    );
  }
}
