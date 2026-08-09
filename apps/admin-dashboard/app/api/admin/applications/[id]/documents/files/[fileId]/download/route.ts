import { NextRequest } from 'next/server';
import { proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string; fileId: string } },
) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/applications/${encodeURIComponent(context.params.id)}/documents/files/${encodeURIComponent(context.params.fileId)}/download`,
    forwardQuery: false,
  });
}
