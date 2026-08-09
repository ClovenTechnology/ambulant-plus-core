import { NextRequest } from 'next/server';
import {
  applicationGatewayFetch,
  applicationUpstreamJson,
} from '../_gateway';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { response, json } = await applicationGatewayFetch(
    request,
    '/api/applications/public/access',
    { method: 'POST', body },
  );
  return applicationUpstreamJson(response, json);
}
