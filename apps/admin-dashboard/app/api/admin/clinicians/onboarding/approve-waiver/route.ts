// apps/admin-dashboard/app/api/admin/clinicians/onboarding/approve-waiver/route.ts
import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  return forwardToGateway(req, '/api/admin/clinicians/onboarding/approve-waiver', body);
}
