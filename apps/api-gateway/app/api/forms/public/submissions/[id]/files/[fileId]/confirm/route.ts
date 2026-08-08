import { NextRequest } from 'next/server';
import { confirmPublicFormUpload } from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormRequestToken,
} from '../../../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string; fileId: string } },
) {
  try {
    const result = await confirmPublicFormUpload({
      submissionId: context.params.id,
      fileId: context.params.fileId,
      token: publicFormRequestToken(request),
    });
    return publicFormJson(result);
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
