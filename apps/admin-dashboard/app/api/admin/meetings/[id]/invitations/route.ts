import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyAdminJsonBody(request, 'POST', {
    path: `/api/admin/meetings/${encodeURIComponent(params.id)}/invitations`,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyAdminJsonBody(request, 'DELETE', {
    path: `/api/admin/meetings/${encodeURIComponent(params.id)}/invitations`,
  });
}
