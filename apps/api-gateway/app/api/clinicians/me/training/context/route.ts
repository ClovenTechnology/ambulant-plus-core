import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  publicClinicianPayLaterRequest,
} from '@/src/clinicians/onboarding/pay-later';
import {
  getClinicianOnboardingSettings,
  publicClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import {
  resolveClinicianOnboardingEntitlements,
  resolvePermanentStarterKitFulfilment,
} from '@/src/clinicians/onboarding/entitlements';
import {
  normaliseTrainingMode,
  publicTrainingSlot,
} from '@/src/clinicians/onboarding/training';
import {
  trainingRoomLifecycle,
} from '@/src/clinicians/onboarding/training-admission';

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
) {
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
) {
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
) {
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

function safeParseJson(
  value: unknown,
): any {
  if (!value) return {};

  if (
    typeof value === 'object'
  ) {
    return value;
  }

  try {
    return JSON.parse(
      String(value),
    );
  }
  catch {
    return {};
  }
}

function extractTrainingCertificate(
  profileJson: any,
) {
  const training =
    profileJson?.training || {};

  const qualifications =
    Array.isArray(
      profileJson
        ?.additionalQualifications,
    )
      ? profileJson
          .additionalQualifications
      : [];

  const trainingQualification =
    qualifications.find(
      (qualification: any) =>
        String(
          qualification?.degree ||
          '',
        ).trim() ===
        'Ambulant+ Mandatory Clinician Training',
    ) || null;

  return {
    certificateNumber:
      cleanStr(
        training?.certificateNumber,
        120,
      ) ||
      cleanStr(
        trainingQualification
          ?.certificateNumber,
        120,
      ) ||
      null,
    completedAt:
      cleanStr(
        training?.completedAt,
        80,
      ) ||
      cleanStr(
        trainingQualification
          ?.completedAt,
        80,
      ) ||
      null,
    institution:
      cleanStr(
        trainingQualification
          ?.institution,
        120,
      ) ||
      'Ambulant+ / Cloven Technology',
  };
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
    const requestedClinicianId =
      cleanStr(
        request.nextUrl
          .searchParams
          .get('clinicianId'),
        120,
      );

    const identity =
      await resolveAuthenticatedClinician(
        request,
        requestedClinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const db: any = prisma;
    const clinician =
      identity.clinician;

    const onboarding =
      await db.clinicianOnboarding
        .findFirst({
          where: {
            clinicianId:
              clinician.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    const latestPayLaterRequest =
      onboarding
        ? await db
            .clinicianOnboardingPayLaterRequest
            .findFirst({
              where: {
                clinicianId:
                  String(
                    clinician.id,
                  ),
              },
              orderBy: [
                {
                  requestedAt: 'desc',
                },
                {
                  createdAt: 'desc',
                },
              ],
            })
            .catch(() => null)
        : null;

    const trainingSlot =
      onboarding?.trainingSlotId
        ? await db
            .clinicianTrainingSlot
            .findUnique({
              where: {
                id:
                  onboarding
                    .trainingSlotId,
              },
            })
        : null;

    const dispatches =
      await db.clinicianDispatch
        .findMany({
          where: {
            clinicianId:
              clinician.id,
          },
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    const dispatch =
      dispatches[0] || null;

    const rawProfile =
      safeParseJson(
        (clinician as any)
          ?.meta?.rawProfile,
      ) ||
      safeParseJson(
        (clinician as any)
          ?.meta?.rawProfileJson,
      ) ||
      safeParseJson(
        (clinician as any)
          ?.metadata?.rawProfile,
      ) ||
      safeParseJson(
        (clinician as any)
          ?.metadata?.rawProfileJson,
      );

    const trainingCertificate =
      extractTrainingCertificate(
        rawProfile,
      );

    const trainingCompleted =
      clinician?.trainingCompleted ===
        true ||
      String(
        onboarding?.status || '',
      ).toLowerCase() ===
        'training_completed' ||
      String(
        rawProfile
          ?.onboarding?.stage ||
        '',
      ).toLowerCase() ===
        'training_completed' ||
      String(
        rawProfile
          ?.training?.status ||
        '',
      ).toLowerCase() ===
        'completed' ||
      Boolean(
        trainingCertificate
          .certificateNumber &&
        trainingCertificate
          .completedAt,
      );

    const certificateAvailable =
      Boolean(
        trainingCertificate
          .certificateNumber &&
        trainingCertificate
          .completedAt,
      );

    const certificateUrl =
      certificateAvailable
        ? '/api/clinicians/me/training/certificate'
        : null;

    const settings =
      await getClinicianOnboardingSettings();

    const publicSettings =
      publicClinicianOnboardingSettings(
        settings,
      );

    const entitlements =
      await resolveClinicianOnboardingEntitlements(
        db,
        String(clinician.id),
        onboarding,
        settings,
      );

    const fulfilment =
      resolvePermanentStarterKitFulfilment(
        entitlements,
        dispatches,
      );

    const paymentState =
      entitlements.paymentState;

    const paymentPlan =
      cleanStr(
        onboarding?.paymentPlan,
        120,
      );

    const payLaterPathwayActive =
      entitlements.pathwayKey ===
      'START_NOW_PAY_LATER';

    const currency =
      publicSettings.currency;

    const trainingFeeCents =
      publicSettings
        .trainingFeeCents;

    const paymentProvider =
      publicSettings
        .paymentProvider;

    const publicTrainingProgramme =
      trainingSlot
        ? publicTrainingSlot(
            trainingSlot,
          )
        : null;

    const selectedTrainingMode =
      normaliseTrainingMode(
        onboarding?.trainingMode ||
        publicTrainingProgramme
          ?.allowedModes?.[0] ||
        trainingSlot?.mode,
      );

    const roomLifecycle =
      trainingSlot
        ? trainingRoomLifecycle({
            startsAt:
              new Date(
                trainingSlot.startsAt,
              ),
            endsAt:
              new Date(
                trainingSlot.endsAt,
              ),
          })
        : null;

    return NextResponse.json(
      {
        ok: true,
        clinician: {
          id:
            String(clinician.id),
          name:
            cleanStr(
              clinician.displayName,
              240,
            ),
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
              clinician.specialty,
              240,
            ),
          status:
            cleanStr(
              clinician.status,
              80,
            ),
        },
        onboarding:
          onboarding
            ? {
                stage:
                  trainingCompleted
                    ? 'training_completed'
                    : outwardStage(
                        onboarding.status,
                      ),
                notes:
                  cleanStr(
                    onboarding
                      .trainingNotes,
                    2000,
                  ),
                depositPaid:
                  entitlements
                    .depositQualified,
                paymentPlan,
                paymentStatus:
                  payLaterPathwayActive
                    ? 'waiver'
                    : paymentState
                        .paymentStatus,
                amountPaidCents:
                  paymentState
                    .amountPaidCents,
                outstandingCents:
                  paymentState
                    .outstandingCents,
                initialRequirementMet:
                  paymentState
                    .initialRequirementMet,
                nextPaymentAt:
                  asIso(
                    onboarding
                      .nextPaymentAt,
                  ),
                waiverActive:
                  payLaterPathwayActive,
              }
            : null,
        payLaterRequest:
          publicClinicianPayLaterRequest(
            latestPayLaterRequest,
          ),
        training:
          trainingSlot
            ? {
                ...(
                  publicTrainingProgramme ||
                  {}
                ),
                slotId:
                  String(
                    trainingSlot.id,
                  ),
                trainingSlotId:
                  String(
                    trainingSlot.id,
                  ),
                status:
                  trainingCompleted
                    ? 'completed'
                    : outwardTrainingStatus(
                        trainingSlot
                          .status,
                      ),
                mode:
                  selectedTrainingMode,
                selectedMode:
                  selectedTrainingMode,
                joinUrl:
                  cleanStr(
                    trainingSlot
                      .meetingUrl,
                    1000,
                  ),
                paid:
                  entitlements
                    .trainingAccess,
                currency,
                feeCents:
                  trainingFeeCents,
                certificateNumber:
                  trainingCertificate
                    .certificateNumber,
                certificateCompletedAt:
                  trainingCertificate
                    .completedAt,
                certificateInstitution:
                  trainingCertificate
                    .institution,
                certificateAvailable,
                certificateUrl,
                roomState:
                  roomLifecycle?.state ||
                  null,
                canJoin:
                  roomLifecycle?.canJoin ||
                  false,
                joinOpensAt:
                  roomLifecycle
                    ?.joinOpensAt
                    .toISOString() ||
                  null,
                joinClosesAt:
                  roomLifecycle
                    ?.joinClosesAt
                    .toISOString() ||
                  null,
              }
            : {
                slotId: null,
                trainingSlotId: null,
                title: null,
                summary: null,
                status:
                  trainingCompleted
                    ? 'completed'
                    : null,
                startAt: null,
                endAt: null,
                timezone:
                  publicSettings
                    .trainingPolicy
                    .timezone,
                durationDays:
                  publicSettings
                    .trainingPolicy
                    .defaultDurationDays,
                totalDurationMinutes:
                  publicSettings
                    .trainingPolicy
                    .defaultSessionDurationMinutes,
                capacity: 0,
                usedCount: 0,
                seatsLeft: 0,
                mode: null,
                selectedMode: null,
                allowedModes: [],
                sessions: [],
                trainerName: null,
                venueName: null,
                venueAddress: null,
                virtualInstructions: null,
                inPersonInstructions: null,
                bookingOpensAt: null,
                bookingClosesAt: null,
                joinUrl: null,
                roomState: null,
                canJoin: false,
                joinOpensAt: null,
                joinClosesAt: null,
                paid:
                  entitlements
                    .trainingAccess,
                currency,
                feeCents:
                  trainingFeeCents,
                certificateNumber:
                  trainingCertificate
                    .certificateNumber,
                certificateCompletedAt:
                  trainingCertificate
                    .completedAt,
                certificateInstitution:
                  trainingCertificate
                    .institution,
                certificateAvailable,
                certificateUrl,
              },
        dispatch:
          dispatch
            ? {
                id:
                  String(dispatch.id),
                status:
                  outwardDispatchStatus(
                    dispatch.status,
                  ),
                courierName:
                  cleanStr(
                    dispatch.courier,
                    240,
                  ),
                trackingCode:
                  cleanStr(
                    dispatch
                      .trackingCode,
                    240,
                  ),
                trackingUrl:
                  cleanStr(
                    dispatch
                      .trackingUrl,
                    1000,
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
                    ? dispatch.items.map(
                        (item: any) => ({
                          label:
                            cleanStr(
                              item?.label,
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
        entitlements:
          publicEntitlements(
            entitlements,
            fulfilment,
          ),
        pricing: {
          ...publicSettings,
          currency,
          trainingFeeCents,
          paymentProvider:
            paymentProvider ===
              'paystack' ||
            paymentProvider ===
              'payfast' ||
            paymentProvider ===
              'mock'
              ? paymentProvider
              : 'unknown',
          amountPaidCents:
            paymentState
              .amountPaidCents,
          outstandingCents:
            paymentState
              .outstandingCents,
          initialPaymentDueCents:
            publicSettings
              .minimumInitialPaymentCents,
          paymentStatus:
            payLaterPathwayActive
              ? 'waiver'
              : paymentState
                  .paymentStatus,
          initialRequirementMet:
            paymentState
              .initialRequirementMet,
          fullyPaid:
            paymentState.fullyPaid,
          paymentPlan,
          waiverActive:
            payLaterPathwayActive,
          effectivePathwayKey:
            entitlements.pathwayKey,
          privileges:
            entitlements.privileges,
          temporaryTrainingDevicesAllowed:
            false,
          permanentStarterKitRequiresDepositOrFullPayment:
            entitlements
              .starterKitRelease ===
            'none',
        },
        bankInstructions:
          publicSettings
            .bankInstructions,
        starterKitItems:
          publicSettings
            .starterKitItems,
        starterKitDepositItems:
          publicSettings
            .starterKitDepositItems,
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
      '[api-gateway][clinicians/me/training/context] error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          String(
            error?.message ||
            'training_context_failed',
          ),
      },
      {
        status: 500,
      },
    );
  }
}
