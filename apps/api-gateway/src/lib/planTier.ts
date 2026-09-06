// apps/api-gateway/src/lib/planTier.ts
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { readIdentity, requireTrustedIdentityInProduction } from './identity';

/**
 * Commercial plan IDs persisted in the clinician profile and managed by the
 * platform plan settings / clinician payout settings surfaces.
 */
export type ClinicianPlanId =
  | 'solo'
  | 'starter'
  | 'team'
  | 'group'
  | 'clinic_enterprise'
  | null;

/**
 * Feature / analytics tiers used across apps:
 *
 *   free  -> no active clinician plan
 *   basic -> solo
 *   pro   -> starter
 *   host  -> team / group / clinic_enterprise
 */
export type PlanTier = 'free' | 'basic' | 'pro' | 'host';

export function mapPlanIdToTier(planId: ClinicianPlanId): PlanTier {
  switch (planId) {
    case 'solo':
      return 'basic';
    case 'starter':
      return 'pro';
    case 'team':
    case 'group':
    case 'clinic_enterprise':
      return 'host';
    default:
      return 'free';
  }
}

const PLAN_IDS = new Set<Exclude<ClinicianPlanId, null>>([
  'solo',
  'starter',
  'team',
  'group',
  'clinic_enterprise',
]);

function record(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePlanId(value: unknown): ClinicianPlanId {
  const id = clean(value) as Exclude<ClinicianPlanId, null>;
  return PLAN_IDS.has(id) ? id : null;
}

function clinicianProfileView(clinician: any) {
  const meta = record(clinician?.meta);
  const profile =
    meta.rawProfile && typeof meta.rawProfile === 'object'
      ? record(meta.rawProfile)
      : typeof meta.rawProfileJson === 'string'
        ? record(meta.rawProfileJson)
        : meta;

  return { meta, profile };
}

/**
 * Resolve the current clinician's plan from trusted request identity and the
 * persisted clinician profile. There are deliberately no demo identities,
 * demo practices, or paid-plan fallbacks here.
 */
export async function getViewerPlanTier(
  req: NextRequest,
): Promise<{
  clinicianId: string | null;
  planId: ClinicianPlanId;
  planTier: PlanTier;
  practiceId: string | null;
  practiceName: string;
}> {
  const identity = readIdentity(req.headers);

  // Production callers must arrive through the governed trusted-identity seam.
  requireTrustedIdentityInProduction(req.headers, identity);

  const refs = [
    clean((identity as any)?.actorRefId),
    clean((identity as any)?.uid),
    clean((identity as any)?.email),
  ].filter(Boolean);

  if (!refs.length) {
    return {
      clinicianId: null,
      planId: null,
      planTier: 'free',
      practiceId: null,
      practiceName: '',
    };
  }

  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: refs.flatMap((ref: string) => [
        { id: ref },
        { userId: ref },
        { email: ref },
      ]),
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!clinician) {
    return {
      clinicianId: null,
      planId: null,
      planTier: 'free',
      practiceId: null,
      practiceName: '',
    };
  }

  const { profile } = clinicianProfileView(clinician);
  const payoutSettings = record(profile.payoutSettings);

  const planId = normalizePlanId(
    payoutSettings.planTierId ??
      profile.planTierId ??
      clinician.planTierId,
  );

  const membershipRefs = [
    clean(clinician.userId),
    clean((identity as any)?.uid),
    clean(clinician.email),
    clean((identity as any)?.email),
  ].filter(Boolean);

  const memberOr: Array<Record<string, string>> = [];
  for (const ref of membershipRefs) {
    memberOr.push({ userId: ref }, { email: ref });
  }

  const membership = memberOr.length
    ? await (prisma as any).practiceMember
        .findFirst({
          where: { OR: memberOr },
          include: { practice: true },
          orderBy: { createdAt: 'asc' },
        })
        .catch(() => null)
    : null;

  const practice = membership?.practice || null;
  const practiceId = clean(membership?.practiceId || practice?.id) || null;
  const practiceName =
    clean(practice?.name || practice?.displayName || practice?.legalName) || '';

  return {
    clinicianId: clean(clinician.id) || null,
    planId,
    planTier: mapPlanIdToTier(planId),
    practiceId,
    practiceName,
  };
}