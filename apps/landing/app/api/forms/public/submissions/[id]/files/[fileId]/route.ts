import { NextRequest } from 'next/server';
import {
  formGatewayFetch,
  submissionTokenFromRequest,
  upstreamJson,
} from '../../../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; fileId: string } },
) {
  const id = encodeURIComponent(String(context.params.id || '').trim());
  const fileId = encodeURIComponent(String(context.params.fileId || '').trim());
  const { response, json } = await formGatewayFetch(
    request,
    `/api/forms/public/submissions/${id}/files/${fileId}`,
    {
      method: 'DELETE',
      submissionToken: submissionTokenFromRequest(request),
    },
  );

  return upstreamJson(response, json);
}
