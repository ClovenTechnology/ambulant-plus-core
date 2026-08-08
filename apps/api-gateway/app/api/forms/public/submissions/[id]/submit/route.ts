import { NextRequest } from 'next/server';
import { submitPublicFormSubmission } from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormJsonBody,
  publicFormRequestClientKey,
  publicFormRequestToken,
} from '../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await publicFormJsonBody(request);
    const result = await submitPublicFormSubmission({
      submissionId: context.params.id,
      token: publicFormRequestToken(request),
      clientKey: publicFormRequestClientKey(request),
      answers: body.answers,
      honeypotPayload: body,
    });
    return publicFormJson(result);
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
