// apps/api-gateway/src/lib/consultations/collaborative-draft-service.ts
import {
  AppointmentVisitMode,
  ConsultationInviteLineRole,
  VisitMode,
} from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import {
  resolveCollaborativeFee,
  computeOrchestrationFeeMinor,
  type InviteLineRole,
} from './collaborative-pricing';

type DraftInviteInput = {
  clinicianId: string;
  role: InviteLineRole;
  specialty?: string | null;
  required?: boolean;
};

type CreateCollaborativeAppointmentDraftArgs = {
  sourceConsultationSessionId?: string | null;
  sourceEncounterId?: string | null;
  appointmentId?: string | null;
  caseId: string;
  patientId: string;
  leadClinicianId: string;
  requestedByClinicianId: string;
  visitMode: AppointmentVisitMode;
  startsAt?: Date | null;
  endsAt?: Date | null;
  durationMin?: number | null;
  invitedClinicians: DraftInviteInput[];
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

function toInviteLineRole(role: InviteLineRole): ConsultationInviteLineRole {
  if (role === 'advisor') return ConsultationInviteLineRole.ADVISOR;
  if (role === 'takeover_followup') return ConsultationInviteLineRole.TAKEOVER_FOLLOWUP;
  return ConsultationInviteLineRole.CO_CLINICIAN;
}

async function resolveLeadClinicianFutureFee(args: {
  clinicianUserId: string;
  visitMode: VisitMode;
  currency: string;
  at?: Date;
}) {
  const at = args.at ?? new Date();

  const baseWhere = {
    clinicianUserId: args.clinicianUserId,
    visitMode: args.visitMode,
    currency: args.currency,
    active: true,
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
  };

  const followup = await prisma.clinicianFee.findFirst({
    where: {
      ...baseWhere,
      kind: 'FOLLOWUP',
    },
    orderBy: [{ effectiveFrom: 'desc' }],
  });

  if (followup) return followup;

  const standard = await prisma.clinicianFee.findFirst({
    where: {
      ...baseWhere,
      kind: 'STANDARD',
    },
    orderBy: [{ effectiveFrom: 'desc' }],
  });

  return standard;
}

export async function createCollaborativeAppointmentDraft(
  args: CreateCollaborativeAppointmentDraftArgs,
) {
  if (!args.invitedClinicians.length) {
    throw new Error('no_invited_clinicians');
  }

  const currency = 'ZAR';
  const appointmentVisitMode = args.visitMode;
  const feeVisitMode = toFeeVisitMode(appointmentVisitMode);

  const leadFee = await resolveLeadClinicianFutureFee({
    clinicianUserId: args.leadClinicianId,
    visitMode: feeVisitMode,
    currency,
  });

  if (!leadFee) {
    throw new Error('lead_clinician_fee_not_configured');
  }

  const invitedLines = [];

  for (const invited of args.invitedClinicians) {
    const fee = await resolveCollaborativeFee({
      clinicianId: invited.clinicianId,
      role: invited.role,
      visitMode: feeVisitMode,
      currency,
    });

    invitedLines.push({
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

  const subtotalMinor =
    leadFee.amountMinor +
    invitedLines.reduce((sum, line) => sum + line.amountMinor, 0) +
    orchestrationMinor;

  const coveredMinor = 0;
  const copayMinor = subtotalMinor;
  const totalMinor = copayMinor;

  const draft = await prisma.collaborativeAppointmentDraft.create({
    data: {
      sourceConsultationSessionId: args.sourceConsultationSessionId ?? null,
      sourceEncounterId: args.sourceEncounterId ?? null,
      appointmentId: args.appointmentId ?? null,
      caseId: args.caseId,
      patientId: args.patientId,
      leadClinicianId: args.leadClinicianId,
      requestedByClinicianId: args.requestedByClinicianId,
      status: 'QUOTED',
      visitMode: appointmentVisitMode,
      startsAt: args.startsAt ?? null,
      endsAt: args.endsAt ?? null,
      durationMin: args.durationMin ?? null,
      currency,
      subtotalMinor,
      coveredMinor,
      copayMinor,
      totalMinor,
      sponsorDecisionJson: {
        mode: 'SELF_PAY',
        reason: 'collaborative_draft_not_yet_mapped_to_sponsor_rules',
      },
      payloadJson: {
        leadClinician: {
          clinicianId: args.leadClinicianId,
          feeKind: leadFee.kind,
          amountMinor: leadFee.amountMinor,
        },
        orchestrationMinor,
      },
      lines: {
        create: [
          {
            clinicianId: args.leadClinicianId,
            role: ConsultationInviteLineRole.CO_CLINICIAN,
            feeKind: leadFee.kind,
            visitMode: appointmentVisitMode,
            specialty: 'lead',
            required: true,
            amountMinor: leadFee.amountMinor,
            currency,
            metadata: { leadClinician: true },
          },
          ...invitedLines.map((line) => ({
            clinicianId: line.clinicianId,
            role: toInviteLineRole(line.role),
            feeKind: line.feeKind,
            visitMode: line.visitMode,
            specialty: line.specialty,
            required: line.required,
            amountMinor: line.amountMinor,
            currency: line.currency,
            metadata: {},
          })),
          ...(orchestrationMinor > 0
            ? [
                {
                  clinicianId: args.leadClinicianId,
                  role: ConsultationInviteLineRole.CO_CLINICIAN,
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
    },
    include: { lines: true },
  });

  emitEvent({
    kind: 'consultation.collaborative_draft.quoted',
    encounterId: args.sourceEncounterId ?? null,
    patientId: args.patientId,
    clinicianId: args.leadClinicianId,
    payload: {
      draftId: draft.id,
      totalMinor: draft.totalMinor,
      currency: draft.currency,
    },
    targets: {
      patientId: args.patientId,
      clinicianId: args.leadClinicianId,
      admin: true,
    },
  });

  return draft;
}

export async function approveCollaborativeAppointmentDraft(draftId: string) {
  const draft = await prisma.collaborativeAppointmentDraft.findUnique({
    where: { id: draftId },
    include: { lines: true },
  });

  if (!draft) throw new Error('collaborative_draft_not_found');

  if (!['DRAFT', 'QUOTED'].includes(draft.status)) {
    throw new Error('collaborative_draft_not_approvable');
  }

  return prisma.collaborativeAppointmentDraft.update({
    where: { id: draft.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    },
    include: { lines: true },
  });
}

export async function declineCollaborativeAppointmentDraft(draftId: string) {
  const draft = await prisma.collaborativeAppointmentDraft.findUnique({
    where: { id: draftId },
    include: { lines: true },
  });

  if (!draft) throw new Error('collaborative_draft_not_found');

  if (!['DRAFT', 'QUOTED'].includes(draft.status)) {
    throw new Error('collaborative_draft_not_declinable');
  }

  return prisma.collaborativeAppointmentDraft.update({
    where: { id: draft.id },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
    },
    include: { lines: true },
  });
}

export async function listCollaborativeAppointmentDrafts(args: {
  sourceConsultationSessionId?: string | null;
  sourceEncounterId?: string | null;
  patientId?: string | null;
}) {
  return prisma.collaborativeAppointmentDraft.findMany({
    where: {
      ...(args.sourceConsultationSessionId
        ? { sourceConsultationSessionId: args.sourceConsultationSessionId }
        : {}),
      ...(args.sourceEncounterId
        ? { sourceEncounterId: args.sourceEncounterId }
        : {}),
      ...(args.patientId ? { patientId: args.patientId } : {}),
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
  });
}