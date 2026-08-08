import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } },
) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}`,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } },
) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}`,
  });
}
