import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { requireApplicationScope } from '@/src/lib/admin-application-access';
import {
  adminApplicationDocumentResponse,
  applicationDocumentDownload,
} from '@/src/lib/admin-application-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string; fileId: string } },
) {
  try {
    requireApplicationScope(
      await requireAdminStaffActor(request),
      'applications.documents.read',
    );
    const result = await applicationDocumentDownload({
      applicationId: context.params.id,
      fileId: context.params.fileId,
    });
    return json(result);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const domain = adminApplicationDocumentResponse(error);
    if (domain) return json(domain.body, domain.status);
    console.error('[admin applications] document download failed', error);
    return json({ ok: false, error: 'application_document_download_failed' }, 500);
  }
}
