import { NextRequest } from 'next/server';
import { proxyTrainingRequest } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyTrainingRequest(
    request,
    '/api/clinicians/onboarding/public-options',
  );
}
