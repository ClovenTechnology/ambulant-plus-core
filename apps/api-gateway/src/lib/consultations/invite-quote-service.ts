import { AppointmentVisitMode, VisitMode } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { resolveCollaborativeFee, computeOrchestrationFeeMinor, type InviteLineRole } from './collaborative-pricing';

type InviteInput = {
  clinicianId: string;
  role: InviteLineRole;
  specialty?: string | null;
  required?: boolean;
};

type CreateSessionInviteQuoteArgs = {
  sessionId: string;
  invitedClinicians: InviteInput[];
  expiresAt?: Date | null;
  actorUid: string;
};

function toFeeVisitMode(mode: AppointmentVisitMode): VisitMode {
  switch (mode) {
    case 'IN_PERSON':
      return VisitMode.in_person;
    case 'HYBRID':
      return VisitMode.hybrid;
    case 'TELEVISIT':
    default:
      return VisitMode.televisit;
  }
}

async function requireSession(sessionId: string) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error('consultation_session_not_found');
  return session;
}

export async function createSessionInviteQuote(args: CreateSessionInviteQuoteArgs) {
  const session = await requireSession(args.sessionId);

  if (!['READY', 'CHECKED_IN', 'ACTIVE', 'INTERRUPTED'].includes(session.state)) {
    throw new Error('consultation_session_not_mutable_for_invite_quote');
  }

  if (!session.roomId) {
    throw new Error('consultation_session_missing_room');
  }

  if (!args.invitedClinicians.length) {
    throw new Error('no_invited_clinicians');
  }

  const currency = session.currency || 'ZAR';
  const appointmentVisitMode = session.visitMode as AppointmentVisitMode;
  const feeVisitMode = toFeeVisitMode(appointmentVisitMode);

  const resolvedLines = [];
  for (const invited of args.invitedClinicians) {
    const fee = await resolveCollaborativeFee({
      clinicianId: invited.clinicianId,
      role: invited.role,
      visitMode: feeVisitMode,
      currency,
    });

    resolvedLines.push({
      clinicianId: invited.clinicianId,
      role: invited.role,
      specialty: invited.specialty ?? null,
      required: invited.required !== false,
      feeKind: fee.feeKind,
      amountMinor: fee.amountMinor,
      currency: fee.currency,
      visitMode: appointmentVisitMode,
    });
  }

  const orchestrationMinor = computeOrchestrationFeeMinor({
    participantCount: 2 + args.invitedClinicians.length,
    invitedClinicianCount: args.invitedClinicians.length,
  });

  const clinicianSubtotal = resolvedLines.reduce((sum, l) => sum + l.amountMinor, 0);
  const subtotalMinor = clinicianSubtotal + orchestrationMinor;

  const coveredMinor = 0;
  const copayMinor = subtotalMinor;
  const totalMinor = copayMinor;

  const quote = await prisma.consultationSessionInviteQuote.create({
    data: {
      consultationSessionId: session.id,
      appointmentId: session.appointmentId,
      encounterId: session.encounterId,
      caseId: session.caseId,
      patientId: session.patientId,
      leadClinicianId: session.clinicianId,
      requestedByClinicianId: args.actorUid,
      intent: 'LIVE_JOIN_NOW',
      status: 'REQUESTED',
      currency,
      subtotalMinor,
      coveredMinor,
      copayMinor,
      totalMinor,
      sponsorDecisionJson: {
        mode: 'SELF_PAY',
        reason: 'specialist_incremental_quote_not_yet_mapped_to_sponsor_rules',
      },
      payloadJson: {
        orchestrationMinor,
        invitedClinicians: resolvedLines,
      },
      expiresAt: args.expiresAt ?? null,
      lines: {
        create: [
          ...resolvedLines.map((l) => ({
            clinicianId: l.clinicianId,
            role:
              l.role === 'advisor'
                ? 'ADVISOR'
                : l.role === 'co_clinician'
                  ? 'CO_CLINICIAN'
                  : 'TAKEOVER_FOLLOWUP',
            feeKind: l.feeKind,
            visitMode: l.visitMode,
            specialty: l.specialty,
            required: l.required,
            amountMinor: l.amountMinor,
            currency: l.currency,
            metadata: {},
          })),
          ...(orchestrationMinor > 0
            ? [
                {
                  clinicianId: session.clinicianId,
                  role: 'CO_CLINICIAN' as const,
                  feeKind: 'PROCEDURE' as const,
                  visitMode: appointmentVisitMode,
                  specialty: 'orchestration',
                  required: true,
                  amountMinor: orchestrationMinor,
                  currency,
                  metadata: { systemLine: true, code: 'ORCHESTRATION' },
                },
              ]
            : []),
        ],
      },
    } as any,
    include: {
      lines: true,
    } as any,
  });

  emitEvent({
    kind: 'consultation.invite_quote.requested',
    encounterId: session.encounterId,
    patientId: session.patientId,
    clinicianId: session.clinicianId,
    targetPatientId: session.patientId,
    payload: {
      sessionId: session.id,
      quoteId: quote.id,
      totalMinor: quote.totalMinor,
      currency: quote.currency,
    },
  });

  return quote;
}

export async function approveSessionInviteQuote(args: {
  sessionId: string;
  quoteId: string;
  actorUid: string;
}) {
  const session = await requireSession(args.sessionId);

  const quote = await prisma.consultationSessionInviteQuote.findFirst({
    where: {
      id: args.quoteId,
      consultationSessionId: session.id,
    },
    include: { lines: true } as any,
  } as any);

  if (!quote) throw new Error('invite_quote_not_found');
  if (quote.status !== 'REQUESTED') throw new Error('invite_quote_not_approvable');

  const updated = await prisma.consultationSessionInviteQuote.update({
    where: { id: quote.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    },
    include: { lines: true } as any,
  } as any);

  emitEvent({
    kind: 'consultation.invite_quote.approved',
    encounterId: session.encounterId,
    patientId: session.patientId,
    clinicianId: session.clinicianId,
    targetClinicianId: session.clinicianId,
    payload: {
      sessionId: session.id,
      quoteId: updated.id,
      totalMinor: updated.totalMinor,
      currency: updated.currency,
    },
  });

  return updated;
}

export async function declineSessionInviteQuote(args: {
  sessionId: string;
  quoteId: string;
  actorUid: string;
}) {
  const session = await requireSession(args.sessionId);

  const quote = await prisma.consultationSessionInviteQuote.findFirst({
    where: {
      id: args.quoteId,
      consultationSessionId: session.id,
    },
    include: { lines: true } as any,
  } as any);

  if (!quote) throw new Error('invite_quote_not_found');
  if (quote.status !== 'REQUESTED') throw new Error('invite_quote_not_declinable');

  const updated = await prisma.consultationSessionInviteQuote.update({
    where: { id: quote.id },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
    },
    include: { lines: true } as any,
  } as any);

  emitEvent({
    kind: 'consultation.invite_quote.declined',
    encounterId: session.encounterId,
    patientId: session.patientId,
    clinicianId: session.clinicianId,
    targetClinicianId: session.clinicianId,
    payload: {
      sessionId: session.id,
      quoteId: updated.id,
      totalMinor: updated.totalMinor,
      currency: updated.currency,
    },
  });

  return updated;
}

export async function listSessionInviteQuotes(sessionId: string) {
  return prisma.consultationSessionInviteQuote.findMany({
    where: { consultationSessionId: sessionId },
    orderBy: { createdAt: 'desc' },
    include: { lines: true } as any,
  } as any);
}