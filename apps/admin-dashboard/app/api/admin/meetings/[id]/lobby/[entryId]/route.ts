import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } },
) {
  return proxyAdminJsonBody(request, 'POST', {
    path: `/api/admin/meetings/${encodeURIComponent(params.id)}/lobby/${encodeURIComponent(params.entryId)}`,
  });
}
