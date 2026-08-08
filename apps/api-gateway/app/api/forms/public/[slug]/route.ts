import { NextRequest } from 'next/server';
import {
  findPublicFormVersion,
  serializePublicForm,
} from '@/src/lib/public-forms';
import {
  publicFormErrorResponse,
  publicFormJson,
} from '../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: { slug: string } },
) {
  try {
    const version = await findPublicFormVersion(context.params.slug);
    return publicFormJson({ ok: true, form: serializePublicForm(version) });
  } catch (error) {
    return publicFormErrorResponse(error);
  }
}
