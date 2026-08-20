import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/content`,
  });
}
