import { NextRequest } from 'next/server';
import { removePublicFormUpload } from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormRequestToken,
} from '../../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; fileId: string } },
) {
  try {
    const result = await removePublicFormUpload({
      submissionId: context.params.id,
      fileId: context.params.fileId,
      token: publicFormRequestToken(request),
    });
    return publicFormJson(result);
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
