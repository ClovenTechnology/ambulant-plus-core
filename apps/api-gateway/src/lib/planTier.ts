// apps/api-gateway/lib/planTier.ts
import type { NextRequest } from 'next/server';

/**
 * Commercial plan IDs persisted in DB and managed via:
 *   /api/settings/plans
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
 *   free  -> no subscription
 *   basic -> solo
 *   pro   -> starter
 *   host  -> team / group / clinic_enterprise
 *
 * If we later want to distinguish enterprise hosts, we can add
 * an 'enterprise_host' tier and remap only here.
 */
export type PlanTier = 'free' | 'basic' | 'pro' | 'host';

/**
 * Pure mapping: DB plan ID -> analytics plan tier.
 * Single source of truth.
 */
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

/**
 * Resolve the viewer's plan *tier* from request context.
 *
 * TODO: Wire this into your real auth + Prisma models:
 *  - Identify current user / clinician from headers or session.
 *  - Look up their active subscription (solo|starter|team|group|clinic_enterprise|null).
 *  - Resolve their primary practice / organisation.
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
  // TEMP: use headers as a simple identity until you plug in your auth helper.
  const clinicianId =
    req.headers.get('x-uid') ||
    req.headers.get('x-user-id') ||
    'clin-demo-host';

  // TODO: Prisma lookup to map clinician -> organisation/practice
  const practiceId = 'prac-demo-001';
  const practiceName = 'Demo Virtual Practice';

  // TODO: Prisma lookup for subscription / plan link
  const planId: ClinicianPlanId = 'clinic_enterprise';

  const planTier = mapPlanIdToTier(planId);

  return {
    clinicianId,
    planId,
    planTier,
    practiceId,
    practiceName,
  };
}
