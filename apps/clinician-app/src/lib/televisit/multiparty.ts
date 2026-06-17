export type PatientPlanTier =
  | 'free'
  | 'plus'
  | 'family'
  | 'pro'
  | 'enterprise';

export type ClinicianPlanTier =
  | 'solo'
  | 'group'
  | 'specialist'
  | 'enterprise';

export type ParticipantRole =
  | 'lead_patient'
  | 'dependent_patient'
  | 'observer'
  | 'care_ally'
  | 'lead_clinician'
  | 'co_clinician'
  | 'advisor';

export type AttendanceMode = 'required' | 'optional';

export type InvitedClinicianRole =
  | 'advisor'
  | 'co_clinician'
  | 'takeover_followup';

export type AvailabilityStatus = 'green' | 'amber' | 'red';

export type MultipartyParticipant = {
  id: string;
  role: ParticipantRole;
  displayName: string;
  attendanceMode: AttendanceMode;
  patientId?: string | null;
  clinicianId?: string | null;
  email?: string | null;
  phone?: string | null;
  accepted?: boolean;
  calendarFree?: boolean;
  preflightReady?: boolean;
  paymentReady?: boolean;
};

export type InvitedClinicianInput = {
  clinicianId: string;
  displayName?: string;
  specialty?: string | null;
  role: InvitedClinicianRole;
  standardConsultFeeZar: number;
  followUpFeeZar?: number | null;
  expectedMinutes?: number | null;
  required?: boolean;
};

export type QuoteLineKind =
  | 'base_consult'
  | 'invited_clinician_addon'
  | 'multiparty_room_surcharge'
  | 'observer_pack'
  | 'after_hours_surcharge';

export type QuoteLine = {
  kind: QuoteLineKind;
  code: string;
  label: string;
  amountZar: number;
  clinicianId?: string | null;
  meta?: Record<string, unknown>;
};

export type MultipartyQuoteInput = {
  patientPlan: PatientPlanTier;
  leadClinicianPlan: ClinicianPlanTier;
  leadClinicianId: string;
  leadClinicianFeeZar: number;
  invitedClinicians?: InvitedClinicianInput[];
  remotePatientParticipants: number;
  remoteObservers: number;
  afterHours?: boolean;
};

export type MultipartyQuote = {
  currency: 'ZAR';
  lines: QuoteLine[];
  subtotalZar: number;
  totalZar: number;
  multipartyRequired: boolean;
  patientPlanEligible: boolean;
  clinicianPlanEligible: boolean;
  blockers: string[];
};

export type SessionEntitlements = {
  maxPatientParticipants: number;
  maxRemoteObservers: number;
  maxClinicians: number;
  multipartyEnabled: boolean;
  multispecialtyEnabled: boolean;
};

export function getSessionEntitlements(
  patientPlan: PatientPlanTier,
  leadClinicianPlan: ClinicianPlanTier,
): SessionEntitlements {
  const patientCaps: Record<
    PatientPlanTier,
    Pick<SessionEntitlements, 'maxPatientParticipants' | 'maxRemoteObservers' | 'multipartyEnabled'>
  > = {
    free: { maxPatientParticipants: 1, maxRemoteObservers: 0, multipartyEnabled: false },
    plus: { maxPatientParticipants: 2, maxRemoteObservers: 1, multipartyEnabled: true },
    family: { maxPatientParticipants: 4, maxRemoteObservers: 2, multipartyEnabled: true },
    pro: { maxPatientParticipants: 4, maxRemoteObservers: 3, multipartyEnabled: true },
    enterprise: { maxPatientParticipants: 8, maxRemoteObservers: 6, multipartyEnabled: true },
  };

  const clinicianCaps: Record<
    ClinicianPlanTier,
    Pick<SessionEntitlements, 'maxClinicians' | 'multispecialtyEnabled'>
  > = {
    solo: { maxClinicians: 1, multispecialtyEnabled: false },
    group: { maxClinicians: 2, multispecialtyEnabled: true },
    specialist: { maxClinicians: 3, multispecialtyEnabled: true },
    enterprise: { maxClinicians: 6, multispecialtyEnabled: true },
  };

  return {
    ...patientCaps[patientPlan],
    ...clinicianCaps[leadClinicianPlan],
  };
}

function roundMoney(n: number) {
  return Math.max(0, Math.round(n * 100) / 100);
}

function computeInvitedClinicianAddonZar(input: InvitedClinicianInput): number {
  const base = Math.max(0, input.standardConsultFeeZar);

  switch (input.role) {
    case 'advisor':
      return roundMoney(base * 0.35);
    case 'co_clinician':
      return roundMoney(base * 0.6);
    case 'takeover_followup':
      return roundMoney(
        input.followUpFeeZar != null
          ? input.followUpFeeZar
          : Math.max(base * 0.75, base),
      );
    default:
      return roundMoney(base);
  }
}

function computeMultipartyRoomSurchargeZar(
  remotePatientParticipants: number,
  remoteObservers: number,
): number {
  const extraPatientSeats = Math.max(0, remotePatientParticipants - 1);
  const observerSeats = Math.max(0, remoteObservers);

  const patientSeatCharge = extraPatientSeats * 55;
  const observerSeatCharge = observerSeats * 35;

  return roundMoney(patientSeatCharge + observerSeatCharge);
}

export function buildMultipartyQuote(input: MultipartyQuoteInput): MultipartyQuote {
  const entitlements = getSessionEntitlements(input.patientPlan, input.leadClinicianPlan);
  const invited = input.invitedClinicians ?? [];
  const clinicianCount = 1 + invited.length;

  const blockers: string[] = [];

  if (input.remotePatientParticipants > entitlements.maxPatientParticipants) {
    blockers.push('patient_plan_participant_limit_exceeded');
  }

  if (input.remoteObservers > entitlements.maxRemoteObservers) {
    blockers.push('patient_plan_observer_limit_exceeded');
  }

  if (clinicianCount > entitlements.maxClinicians) {
    blockers.push('clinician_plan_limit_exceeded');
  }

  if (invited.length > 0 && !entitlements.multispecialtyEnabled) {
    blockers.push('lead_clinician_plan_does_not_allow_invited_clinicians');
  }

  const lines: QuoteLine[] = [
    {
      kind: 'base_consult',
      code: 'BASE_CONSULT',
      label: 'Lead clinician consultation',
      amountZar: roundMoney(input.leadClinicianFeeZar),
      clinicianId: input.leadClinicianId,
    },
  ];

  invited.forEach((c, i) => {
    lines.push({
      kind: 'invited_clinician_addon',
      code: `INVITED_CLINICIAN_${i + 1}`,
      label:
        c.role === 'advisor'
          ? `Advisor add-on${c.specialty ? ` • ${c.specialty}` : ''}`
          : c.role === 'co_clinician'
          ? `Co-clinician add-on${c.specialty ? ` • ${c.specialty}` : ''}`
          : `Specialist follow-up${c.specialty ? ` • ${c.specialty}` : ''}`,
      amountZar: computeInvitedClinicianAddonZar(c),
      clinicianId: c.clinicianId,
      meta: {
        role: c.role,
        specialty: c.specialty ?? null,
        expectedMinutes: c.expectedMinutes ?? null,
      },
    });
  });

  const roomSurcharge = computeMultipartyRoomSurchargeZar(
    input.remotePatientParticipants,
    input.remoteObservers,
  );

  if (roomSurcharge > 0) {
    lines.push({
      kind: 'multiparty_room_surcharge',
      code: 'MULTIPARTY_ROOM',
      label: 'Multiparty Televisit orchestration',
      amountZar: roomSurcharge,
    });
  }

  if (input.afterHours) {
    lines.push({
      kind: 'after_hours_surcharge',
      code: 'AFTER_HOURS',
      label: 'After-hours service',
      amountZar: 95,
    });
  }

  const subtotalZar = roundMoney(lines.reduce((sum, l) => sum + l.amountZar, 0));
  const totalZar = subtotalZar;

  return {
    currency: 'ZAR',
    lines,
    subtotalZar,
    totalZar,
    multipartyRequired:
      input.remotePatientParticipants > 1 ||
      input.remoteObservers > 0 ||
      invited.length > 0,
    patientPlanEligible:
      !blockers.includes('patient_plan_participant_limit_exceeded') &&
      !blockers.includes('patient_plan_observer_limit_exceeded'),
    clinicianPlanEligible:
      !blockers.includes('clinician_plan_limit_exceeded') &&
      !blockers.includes('lead_clinician_plan_does_not_allow_invited_clinicians'),
    blockers,
  };
}

export type RosterAvailabilityInput = {
  requiredParticipants: MultipartyParticipant[];
  optionalParticipants?: MultipartyParticipant[];
};

export type RosterAvailabilityResult = {
  status: AvailabilityStatus;
  requiredReady: number;
  requiredTotal: number;
  optionalReady: number;
  optionalTotal: number;
  blockers: string[];
};

function isPartyGreen(p: MultipartyParticipant) {
  return Boolean(
    p.accepted !== false &&
      p.calendarFree !== false &&
      p.preflightReady !== false &&
      p.paymentReady !== false,
  );
}

export function computeRosterAvailability(
  input: RosterAvailabilityInput,
): RosterAvailabilityResult {
  const required = input.requiredParticipants ?? [];
  const optional = input.optionalParticipants ?? [];

  const requiredReady = required.filter(isPartyGreen).length;
  const optionalReady = optional.filter(isPartyGreen).length;

  const blockers: string[] = [];

  required.forEach((p) => {
    if (p.accepted === false) blockers.push(`${p.id}:not_accepted`);
    if (p.calendarFree === false) blockers.push(`${p.id}:calendar_conflict`);
    if (p.preflightReady === false) blockers.push(`${p.id}:preflight_not_ready`);
    if (p.paymentReady === false) blockers.push(`${p.id}:payment_not_ready`);
  });

  let status: AvailabilityStatus = 'green';
  if (blockers.length > 0) status = 'red';
  else if (optional.length > optionalReady) status = 'amber';

  return {
    status,
    requiredReady,
    requiredTotal: required.length,
    optionalReady,
    optionalTotal: optional.length,
    blockers,
  };
}