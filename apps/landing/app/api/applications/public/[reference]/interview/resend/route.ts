import { NextRequest } from 'next/server';
import {
  applicationAccessTokenFromRequest,
  applicationGatewayFetch,
  applicationUpstreamJson,
} from '../../../_gateway';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string } },
) {
  const { response, json } = await applicationGatewayFetch(
    request,
    `/api/applications/public/${encodeURIComponent(context.params.reference)}/interview/resend`,
    {
      method: 'POST',
      body: {},
      accessToken: applicationAccessTokenFromRequest(request),
    },
  );
  return applicationUpstreamJson(response, json);
}
