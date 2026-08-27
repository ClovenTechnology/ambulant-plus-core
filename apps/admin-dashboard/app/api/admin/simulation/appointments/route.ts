import { NextRequest } from 'next/server';
import { readJson, forwardAdminSessionRequest } from '../../clinicians/onboarding/_helpers';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return forwardAdminSessionRequest(req, '/api/admin/simulation/appointments', { method: 'GET' });
}
export async function POST(req: NextRequest) {
  return forwardAdminSessionRequest(req, '/api/admin/simulation/appointments', { method: 'POST', body: await readJson(req) });
}
export async function PATCH(req: NextRequest) {
  return forwardAdminSessionRequest(req, '/api/admin/simulation/appointments', { method: 'PATCH', body: await readJson(req) });
}
