import { NextRequest } from 'next/server';
import { createPublicFormUpload } from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormJsonBody,
  publicFormRequestClientKey,
  publicFormRequestToken,
} from '../../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await publicFormJsonBody(request);
    const result = await createPublicFormUpload({
      submissionId: context.params.id,
      token: publicFormRequestToken(request),
      clientKey: publicFormRequestClientKey(request),
      fieldKey: body.fieldKey,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
    });
    return publicFormJson({ ok: true, ...result }, 201);
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
