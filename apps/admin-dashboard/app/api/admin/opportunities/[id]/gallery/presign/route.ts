import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'POST', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/gallery/presign`,
  });
}
