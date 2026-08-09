import { NextRequest } from 'next/server';
import {
  applicationAccessTokenFromRequest,
  applicationGatewayFetch,
  applicationUpstreamJson,
} from '../../../../../_gateway';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string; requestId: string } },
) {
  const body = await request.json().catch(() => ({}));
  const { response, json } = await applicationGatewayFetch(
    request,
    `/api/applications/public/${encodeURIComponent(context.params.reference)}/documents/${encodeURIComponent(context.params.requestId)}/files/presign`,
    {
      method: 'POST',
      body,
      accessToken: applicationAccessTokenFromRequest(request),
    },
  );
  return applicationUpstreamJson(response, json);
}
