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