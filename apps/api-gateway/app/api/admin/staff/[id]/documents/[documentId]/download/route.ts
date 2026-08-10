import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { staffEmploymentDocumentDownload, staffEmploymentErrorResponse } from '@/src/lib/staff-employment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const download = await staffEmploymentDocumentDownload({ actor, staffProfileId: params.id, documentId: params.documentId });
    return NextResponse.redirect(download.downloadUrl, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff document download] failed', error);
    return NextResponse.json({ ok: false, error: 'staff_document_download_failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const { archiveStaffEmploymentDocument } = await import('@/src/lib/staff-employment');
    return NextResponse.json(await archiveStaffEmploymentDocument({ request, actor, staffProfileId: params.id, documentId: params.documentId }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff document archive] failed', error);
    return NextResponse.json({ ok: false, error: 'staff_document_archive_failed' }, { status: 500 });
  }
}
