import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationDocumentResponse,
  createApplicationDocumentRequest,
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
  context: { params: { id: string } },
) {
  try {
    const actor = requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.documents.request',
    );
    const payload = await request.json().catch(() => ({}));
    const result = await createApplicationDocumentRequest({
      applicationId: context.params.id,
      payload,
      actor,
      userAgent: request.headers.get('user-agent'),
    });
    return json(result, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationDocumentResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] document request failed', error);
    return json({ ok: false, error: 'application_document_request_failed' }, 500);
  }
}
