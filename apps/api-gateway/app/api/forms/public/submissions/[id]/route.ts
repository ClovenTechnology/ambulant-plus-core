import { NextRequest } from 'next/server';
import {
  getPublicFormSubmission,
  savePublicFormSubmission,
} from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormJsonBody,
  publicFormRequestClientKey,
  publicFormRequestToken,
} from '../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const result = await getPublicFormSubmission({
      submissionId: context.params.id,
      token: publicFormRequestToken(request),
    });
    return publicFormJson({ ok: true, submission: result });
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await publicFormJsonBody(request);
    const result = await savePublicFormSubmission({
      submissionId: context.params.id,
      token: publicFormRequestToken(request),
      clientKey: publicFormRequestClientKey(request),
      answers: body.answers,
    });
    return publicFormJson({ ok: true, submission: result });
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
