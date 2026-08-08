import { NextRequest } from 'next/server';
import {
  formGatewayFetch,
  submissionTokenFromRequest,
  upstreamJson,
} from '../../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const body = await request.json().catch(() => ({}));
  const id = encodeURIComponent(String(context.params.id || '').trim());
  const { response, json } = await formGatewayFetch(
    request,
    `/api/forms/public/submissions/${id}/submit`,
    {
      method: 'POST',
      body,
      submissionToken: submissionTokenFromRequest(request),
    },
  );

  return upstreamJson(response, json);
}
