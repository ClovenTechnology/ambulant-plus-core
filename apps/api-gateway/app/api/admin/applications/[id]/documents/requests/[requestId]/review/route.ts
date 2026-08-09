import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationDocumentResponse,
  reviewApplicationDocumentRequest,
} from '@/src/lib/admin-application-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string; requestId: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.documents.review',
    );
    const payload = await request.json().catch(() => ({}));
    const result = await reviewApplicationDocumentRequest({
      applicationId: context.params.id,
      requestId: context.params.requestId,
      payload,
      actor,
      userAgent: request.headers.get('user-agent'),
    });
    return json(result);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationDocumentResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] document review failed', error);
    return json({ ok: false, error: 'application_document_review_failed' }, 500);
  }
}
