import { NextRequest } from 'next/server';
import {
  formGatewayFetch,
  submissionTokenFromRequest,
  upstreamJson,
} from '../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function submissionPath(id: string) {
  return `/api/forms/public/submissions/${encodeURIComponent(String(id || '').trim())}`;
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const { response, json } = await formGatewayFetch(
    request,
    submissionPath(context.params.id),
    { submissionToken: submissionTokenFromRequest(request) },
  );

  return upstreamJson(response, json);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const body = await request.json().catch(() => ({}));
  const { response, json } = await formGatewayFetch(
    request,
    submissionPath(context.params.id),
    {
      method: 'PATCH',
      body,
      submissionToken: submissionTokenFromRequest(request),
    },
  );

  return upstreamJson(response, json);
}
