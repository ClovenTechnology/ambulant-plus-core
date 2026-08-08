import { NextRequest } from 'next/server';
import {
  findPublicFormVersion,
  startPublicFormSubmission,
} from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
  publicFormJsonBody,
  publicFormRequestClientKey,
} from '../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { slug: string } },
) {
  try {
    const version = await findPublicFormVersion(context.params.slug);
    const body = await publicFormJsonBody(request);
    const antiSpam = version.antiSpamPolicy as Record<string, unknown> | null;
    const honeypotField =
      typeof antiSpam?.honeypotField === 'string' && antiSpam.honeypotField.trim()
        ? antiSpam.honeypotField.trim()
        : '__website';

    const result = await startPublicFormSubmission({
      version,
      clientKey: publicFormRequestClientKey(request),
      locale: body.locale,
      honeypot: body[honeypotField] || body.__website,
    });

    return publicFormJson({ ok: true, ...result }, 201);
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
