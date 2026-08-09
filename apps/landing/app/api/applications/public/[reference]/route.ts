import { NextRequest } from 'next/server';
import {
  applicationAccessTokenFromRequest,
  applicationGatewayFetch,
  applicationUpstreamJson,
} from '../_gateway';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { reference: string } },
) {
  const { response, json } = await applicationGatewayFetch(
    request,
    `/api/applications/public/${encodeURIComponent(context.params.reference)}`,
    { accessToken: applicationAccessTokenFromRequest(request) },
  );
  return applicationUpstreamJson(response, json);
}
