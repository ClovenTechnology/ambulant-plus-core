import { NextRequest } from 'next/server';
import { createApplicationDocumentUpload } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalJsonBody,
  applicationPortalRequestClientKey,
  applicationPortalRequestToken,
} from '../../../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string; requestId: string } },
) {
  try {
    const body = await applicationPortalJsonBody(request);
    const result = await createApplicationDocumentUpload({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
      requestId: context.params.requestId,
      clientKey: applicationPortalRequestClientKey(request),
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
    });
    return applicationPortalJson({ ok: true, ...result }, 201);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
