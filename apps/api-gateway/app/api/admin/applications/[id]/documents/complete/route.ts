import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationDocumentResponse,
  completeApplicationDocumentCycle,
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
      'applications.documents.review',
    );
    const result = await completeApplicationDocumentCycle({
      applicationId: context.params.id,
      actor,
      userAgent: request.headers.get('user-agent'),
    });
    return json(result);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationDocumentResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] document cycle completion failed', error);
    return json({ ok: false, error: 'application_document_cycle_completion_failed' }, 500);
  }
}
