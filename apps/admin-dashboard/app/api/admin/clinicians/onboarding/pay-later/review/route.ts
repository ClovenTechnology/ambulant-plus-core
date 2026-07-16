// apps/admin-dashboard/app/api/admin/clinicians/onboarding/pay-later/review/route.ts
import { NextRequest } from 'next/server';
import {
  forwardToGateway,
  readJson,
} from '../../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
) {
  const body =
    await readJson(req);

  return forwardToGateway(
    req,
    '/api/admin/clinicians/onboarding/pay-later/review',
    body,
  );
}
