import type { InvitedClinicianInput } from '@/src/lib/televisit/multiparty';

export type TelevisitSessionRef = {
  roomId: string;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
};

export type PaymentRequestMessage = {
  from: 'clinician';
  type: 'payment_request';
  text: string;
  quoteId: string;
  totalZar: number;
  invitedClinicians: InvitedClinicianInput[];
  roomId: string;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
  ts: number;
};

export type PaymentResponseMessage = {
  from: 'patient';
  type: 'payment_response';
  approved: boolean;
  quoteId: string | null;
  totalZar: number | null;
  invitedClinicians: InvitedClinicianInput[];
  roomId?: string | null;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
  ts: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseInvitedClinicians(input: unknown): InvitedClinicianInput[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!isRecord(item)) return null;

      const clinicianId =
        typeof item.clinicianId === 'string' ? item.clinicianId.trim() : '';
      if (!clinicianId) return null;

      const role =
        item.role === 'advisor' ||
        item.role === 'co_clinician' ||
        item.role === 'takeover_followup'
          ? item.role
          : 'advisor';

      return {
        clinicianId,
        displayName:
          typeof item.displayName === 'string' ? item.displayName : undefined,
        specialty:
          typeof item.specialty === 'string' ? item.specialty : undefined,
        role,
        standardConsultFeeZar:
          typeof item.standardConsultFeeZar === 'number' &&
          Number.isFinite(item.standardConsultFeeZar)
            ? item.standardConsultFeeZar
            : 0,
        followUpFeeZar:
          typeof item.followUpFeeZar === 'number' &&
          Number.isFinite(item.followUpFeeZar)
            ? item.followUpFeeZar
            : undefined,
        expectedMinutes:
          typeof item.expectedMinutes === 'number' &&
          Number.isFinite(item.expectedMinutes)
            ? item.expectedMinutes
            : undefined,
        required: item.required !== false,
      } satisfies InvitedClinicianInput;
    })
    .filter(Boolean) as InvitedClinicianInput[];
}

export function buildPaymentRequestMessage(input: {
  quoteId: string;
  totalZar: number;
  invitedClinicians: InvitedClinicianInput[];
  session: TelevisitSessionRef;
  text?: string;
  ts?: number;
}): PaymentRequestMessage {
  return {
    from: 'clinician',
    type: 'payment_request',
    text: input.text || 'A specialist add-on requires your approval.',
    quoteId: input.quoteId,
    totalZar: input.totalZar,
    invitedClinicians: input.invitedClinicians,
    roomId: input.session.roomId,
    sessionId: input.session.sessionId ?? null,
    appointmentId: input.session.appointmentId ?? null,
    encounterId: input.session.encounterId ?? null,
    visitId: input.session.visitId ?? null,
    ts: input.ts ?? Date.now(),
  };
}

export function buildPaymentResponseMessage(input: {
  approved: boolean;
  quoteId: string | null;
  totalZar: number | null;
  invitedClinicians: InvitedClinicianInput[];
  session?: Partial<TelevisitSessionRef>;
  ts?: number;
}): PaymentResponseMessage {
  return {
    from: 'patient',
    type: 'payment_response',
    approved: input.approved,
    quoteId: input.quoteId,
    totalZar: input.totalZar,
    invitedClinicians: input.invitedClinicians,
    roomId: input.session?.roomId ?? null,
    sessionId: input.session?.sessionId ?? null,
    appointmentId: input.session?.appointmentId ?? null,
    encounterId: input.session?.encounterId ?? null,
    visitId: input.session?.visitId ?? null,
    ts: input.ts ?? Date.now(),
  };
}

export function parsePaymentRequestMessage(
  parsed: unknown,
): PaymentRequestMessage | null {
  if (!isRecord(parsed)) return null;
  if (parsed.type !== 'payment_request') return null;

  const quoteId = typeof parsed.quoteId === 'string' ? parsed.quoteId : null;
  const totalZar =
    typeof parsed.totalZar === 'number' && Number.isFinite(parsed.totalZar)
      ? parsed.totalZar
      : null;

  if (!quoteId || totalZar === null) return null;

  return {
    from: 'clinician',
    type: 'payment_request',
    text:
      typeof parsed.text === 'string'
        ? parsed.text
        : 'A specialist add-on requires your approval.',
    quoteId,
    totalZar,
    invitedClinicians: parseInvitedClinicians(parsed.invitedClinicians),
    roomId: typeof parsed.roomId === 'string' ? parsed.roomId : '',
    sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
    appointmentId:
      typeof parsed.appointmentId === 'string' ? parsed.appointmentId : null,
    encounterId:
      typeof parsed.encounterId === 'string' ? parsed.encounterId : null,
    visitId: typeof parsed.visitId === 'string' ? parsed.visitId : null,
    ts:
      typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)
        ? parsed.ts
        : Date.now(),
  };
}

export function parsePaymentResponseMessage(
  parsed: unknown,
): PaymentResponseMessage | null {
  if (!isRecord(parsed)) return null;
  if (parsed.type !== 'payment_response') return null;

  return {
    from: 'patient',
    type: 'payment_response',
    approved: Boolean(parsed.approved),
    quoteId: typeof parsed.quoteId === 'string' ? parsed.quoteId : null,
    totalZar:
      typeof parsed.totalZar === 'number' && Number.isFinite(parsed.totalZar)
        ? parsed.totalZar
        : null,
    invitedClinicians: parseInvitedClinicians(parsed.invitedClinicians),
    roomId: typeof parsed.roomId === 'string' ? parsed.roomId : null,
    sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
    appointmentId:
      typeof parsed.appointmentId === 'string' ? parsed.appointmentId : null,
    encounterId:
      typeof parsed.encounterId === 'string' ? parsed.encounterId : null,
    visitId: typeof parsed.visitId === 'string' ? parsed.visitId : null,
    ts:
      typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)
        ? parsed.ts
        : Date.now(),
  };
}