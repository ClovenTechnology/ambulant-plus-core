import { computeClinicianActivationState } from '@/src/lib/clinician-activation';
import { computeClinicianOperationalState } from '@/src/lib/clinician-operational-state';
import { computeClinicianReadiness, type CheckRow } from '@/src/lib/credentialing/readiness';
import { getPolicy } from '@/src/lib/credentialing/policies';

type AnyObj = Record<string, any>;

export function buildClinicianOperationalTrace(args: {
  clinician: AnyObj;
  onboarding?: AnyObj | null;
  trainingSlot?: AnyObj | null;
  dispatch?: AnyObj | null;
  checks?: CheckRow[];
}) {
  const checks = Array.isArray(args.checks) ? args.checks : [];

  const activation = computeClinicianActivationState({
    clinician: args.clinician,
    onboarding: args.onboarding ?? null,
    trainingSlot: args.trainingSlot ?? null,
    dispatch: args.dispatch ?? null,
  });

  const operational = computeClinicianOperationalState({
    clinician: args.clinician,
    onboarding: args.onboarding ?? null,
    trainingSlot: args.trainingSlot ?? null,
    dispatch: args.dispatch ?? null,
    checks,
  });

  const policy = getPolicy(operational.professionKey);

  const readiness = computeClinicianReadiness({
    clinician: {
      id: String(args.clinician?.id || ''),
      status: String(args.clinician?.status || ''),
      disabled: !!args.clinician?.disabled,
      archived: !!args.clinician?.archived,
      trainingCompleted: !!args.clinician?.trainingCompleted,
      professionKey: operational.professionKey,
      bookingEnabled:
        typeof args.clinician?.bookingEnabled === 'boolean'
          ? args.clinician.bookingEnabled
          : null,
    },
    checks,
  });

  return {
    ok: true,
    clinicianId: String(args.clinician?.id || ''),
    professionKey: operational.professionKey,
    policy: policy
      ? {
          found: true,
          track: policy.track,
          tier: policy.tier,
          primaryRegulator: policy.primaryRegulator,
          patientCategory: policy.patientCategory,
          prescribing: policy.rx,
          requiredChecks: policy.requiredChecks,
        }
      : {
          found: false,
        },

    activation: {
      status: activation.activationStatus,
      verificationStatus: activation.verificationStatus,
      trainingStatus: activation.trainingStatus,
      certificateStatus: activation.certificateStatus,
      smartIdStatus: activation.smartIdStatus,
      dispatchStatus: activation.dispatchStatus,
      canPractice: activation.canPractice,
      visibleToPatients: activation.visibleToPatients,
      blockers: activation.blockers,
      evidence: activation.evidence,
    },

    readiness: {
      okToBook: readiness.okToBook,
      bucket: readiness.bucket,
      blockers: readiness.blockers,
      missingChecks: readiness.missingChecks,
    },

    operational: {
      canBeListed: operational.canBeListed,
      canBeBooked: operational.canBeBooked,
      canPrescribe: operational.canPrescribe,
      prescribingMode: operational.prescribingMode,
      maxRxSchedule: operational.maxRxSchedule,
      allowedWorkspaces: operational.allowedWorkspaces,
      patientCategory: operational.patientCategory,
      blockers: operational.blockers,
      riskFlags: operational.riskFlags,
      credentialing: operational.credentialing,
    },

    checks: checks.map((c) => ({
      kind: c.kind,
      regulator: c.regulator ?? 'PLATFORM',
      status: c.status,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    })),

    summary: {
      bookable: operational.canBeBooked,
      listed: operational.canBeListed,
      prescriber: operational.canPrescribe,
      mainBlockers: operational.blockers,
      mainRiskFlags: operational.riskFlags,
    },
  };
}