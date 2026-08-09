import { NextRequest } from 'next/server';
import { removeApplicationDocumentUpload } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalRequestToken,
} from '../../../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: { reference: string; requestId: string; fileId: string } },
) {
  try {
    const result = await removeApplicationDocumentUpload({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
      requestId: context.params.requestId,
      fileId: context.params.fileId,
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
