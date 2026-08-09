import { NextRequest } from 'next/server';
import {
  applicationAccessTokenFromRequest,
  applicationGatewayFetch,
  applicationUpstreamJson,
} from '../../../../../../_gateway';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string; requestId: string; fileId: string } },
) {
  const { response, json } = await applicationGatewayFetch(
    request,
    `/api/applications/public/${encodeURIComponent(context.params.reference)}/documents/${encodeURIComponent(context.params.requestId)}/files/${encodeURIComponent(context.params.fileId)}/confirm`,
    {
      method: 'POST',
      accessToken: applicationAccessTokenFromRequest(request),
    },
  );
  return applicationUpstreamJson(response, json);
}
