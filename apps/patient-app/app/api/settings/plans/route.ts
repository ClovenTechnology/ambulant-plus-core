import { NextResponse } from 'next/server';
import { getConfiguredPatientPlans } from '../../../../lib/adminPlanPricing.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const patientPlans = await getConfiguredPatientPlans();
  return NextResponse.json({ patientPlans });
}
