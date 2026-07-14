import { NextRequest } from 'next/server';
import { json, resolveEnterpriseFinanceAccess, routeError } from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_ACCESS_ENVELOPE_ROUTE

export async function GET(req: NextRequest) {
  try {
    const envelope = await resolveEnterpriseFinanceAccess(req);
    return json({ ok: true, envelope });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_access_envelope_failed');
  }
}
