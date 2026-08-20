import { NextRequest } from 'next/server';
import { proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/revisions`,
  });
}
