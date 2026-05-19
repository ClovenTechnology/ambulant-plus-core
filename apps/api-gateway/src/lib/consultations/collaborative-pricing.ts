// apps/api-gateway/src/lib/consultations/collaborative-pricing.ts
import { ClinicianFeeKind, VisitMode } from '@prisma/client';
import { prisma } from '@/src/lib/db';

export type InviteLineRole = 'advisor' | 'co_clinician' | 'takeover_followup';

export type ResolvedCollaborativeFee = {
  feeKind: ClinicianFeeKind;
  amountMinor: number;
  currency: string;
};

function preferredKindsForRole(role: InviteLineRole): ClinicianFeeKind[] {
  switch (role) {
    case 'advisor':
      return ['ADVISOR', 'CO_SESSION', 'STANDARD'];
    case 'co_clinician':
      return ['CO_SESSION', 'STANDARD'];
    case 'takeover_followup':
      return ['TAKEOVER_FOLLOWUP', 'FOLLOWUP'];
    default:
      return ['STANDARD'];
  }
}

export async function resolveCollaborativeFee(args: {
  clinicianId: string;
  role: InviteLineRole;
  visitMode: VisitMode;
  currency: string;
  at?: Date;
}): Promise<ResolvedCollaborativeFee> {
  const kinds = preferredKindsForRole(args.role);
  const at = args.at ?? new Date();

  for (const kind of kinds) {
    const row = await prisma.clinicianFee.findFirst({
      where: {
        clinicianUserId: args.clinicianId,
        kind,
        visitMode: args.visitMode,
        currency: args.currency,
        active: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }],
    });

    if (row) {
      return {
        feeKind: row.kind,
        amountMinor: row.amountMinor,
        currency: row.currency,
      };
    }
  }

  throw new Error('invited_clinician_fee_not_configured');
}

export function computeOrchestrationFeeMinor(args: {
  participantCount: number;
  invitedClinicianCount: number;
}): number {
  const extraParticipants = Math.max(0, args.participantCount - 2);
  const invited = Math.max(0, args.invitedClinicianCount);

  const base = invited > 0 ? 3500 : 0;
  const participantSurcharge = extraParticipants * 1500;

  return base + participantSurcharge;
}