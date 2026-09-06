// apps/admin-dashboard/app/api/admin/analytics/patient-engagement/route.ts
import type { NextRequest } from 'next/server';
import { GET as getLivePatientEngagement } from '../../../analytics/patient-engagement/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Compatibility route for existing Admin consumers.
 *
 * The former implementation fabricated patient counts, Premium counts,
 * retention, revenue and feature-usage data. Keep the established
 * /api/admin/... contract, but source it from the DB-backed analytics route.
 */
export async function GET(req: NextRequest) {
  return getLivePatientEngagement(req);
}