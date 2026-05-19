import type {
  AppointmentVisitMode,
  ConsultationActorType,
  ConsultationOutcomeKind,
  SettlementClaimState,
  SettlementPayoutState,
  SettlementRefundTarget,
  SettlementRefundType,
} from '@prisma/client';

export type PolicyInput = {
  visitMode: AppointmentVisitMode;
  paymentMethod?: string | null;
  payerType?: string | null;
  startsAt: Date;
  cancelledAt?: Date | null;
  cancelledBy?: ConsultationActorType | null;
  noShowActor?: ConsultationActorType | null;
  sessionStarted: boolean;
  encounterReachedClinicalThreshold: boolean;
  referred: boolean;
};

export type PolicyDecision = {
  outcome: ConsultationOutcomeKind;
  refundType: SettlementRefundType;
  refundTarget: SettlementRefundTarget;
  payoutState: SettlementPayoutState;
  claimState: SettlementClaimState;
  reasonCode: string;
  policyVersion: string;
};

const POLICY_VERSION = 'session-policy-v1';
const LATE_CANCEL_WINDOW_MINUTES = 120;

function diffMinutes(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

export function evaluateSessionPolicy(input: PolicyInput): PolicyDecision {
  if (input.noShowActor === 'PATIENT') {
    return {
      outcome: 'PATIENT_NO_SHOW',
      refundType: 'NONE',
      refundTarget: 'NONE',
      payoutState: 'HOLD',
      claimState: 'SUPPRESS',
      reasonCode: 'PATIENT_NO_SHOW',
      policyVersion: POLICY_VERSION,
    };
  }

  if (input.noShowActor === 'CLINICIAN') {
    return {
      outcome: 'CLINICIAN_NO_SHOW',
      refundType: 'FULL',
      refundTarget: 'PATIENT',
      payoutState: 'ZERO',
      claimState: 'SUPPRESS',
      reasonCode: 'CLINICIAN_NO_SHOW',
      policyVersion: POLICY_VERSION,
    };
  }

  if (input.cancelledBy === 'CLINICIAN') {
    return {
      outcome: 'CLINICIAN_CANCELLED',
      refundType: 'FULL',
      refundTarget: 'PATIENT',
      payoutState: 'ZERO',
      claimState: 'SUPPRESS',
      reasonCode: 'CLINICIAN_CANCELLED',
      policyVersion: POLICY_VERSION,
    };
  }

  if (input.cancelledBy === 'PATIENT') {
    const cancelledAt = input.cancelledAt ?? new Date();
    const minutesBeforeStart = diffMinutes(input.startsAt, cancelledAt);

    if (minutesBeforeStart >= LATE_CANCEL_WINDOW_MINUTES) {
      return {
        outcome: 'PATIENT_CANCELLED_EARLY',
        refundType: 'FULL',
        refundTarget: 'PATIENT',
        payoutState: 'ZERO',
        claimState: 'SUPPRESS',
        reasonCode: 'PATIENT_CANCELLED_EARLY',
        policyVersion: POLICY_VERSION,
      };
    }

    return {
      outcome: 'PATIENT_CANCELLED_LATE',
      refundType: 'PARTIAL',
      refundTarget: 'PATIENT',
      payoutState: 'HOLD',
      claimState: 'SUPPRESS',
      reasonCode: 'PATIENT_CANCELLED_LATE',
      policyVersion: POLICY_VERSION,
    };
  }

  if (!input.sessionStarted) {
    return {
      outcome: 'ABORTED_BEFORE_CLINICAL_WORK',
      refundType: 'FULL',
      refundTarget: 'PATIENT',
      payoutState: 'ZERO',
      claimState: 'SUPPRESS',
      reasonCode: 'ABORTED_BEFORE_CLINICAL_WORK',
      policyVersion: POLICY_VERSION,
    };
  }

  if (input.referred && input.encounterReachedClinicalThreshold) {
    return {
      outcome: 'REFERRED_COMPLETED',
      refundType: 'NONE',
      refundTarget: 'NONE',
      payoutState: 'RELEASE',
      claimState: 'READY',
      reasonCode: 'REFERRED_COMPLETED',
      policyVersion: POLICY_VERSION,
    };
  }

  return {
    outcome: 'COMPLETED',
    refundType: 'NONE',
    refundTarget: 'NONE',
    payoutState: 'RELEASE',
    claimState: 'READY',
    reasonCode: 'COMPLETED',
    policyVersion: POLICY_VERSION,
  };
}