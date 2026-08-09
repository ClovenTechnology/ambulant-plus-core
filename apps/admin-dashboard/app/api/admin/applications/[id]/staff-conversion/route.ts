import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'POST', {
    path: `/api/admin/applications/${encodeURIComponent(params.id)}/staff-conversion`,
  });
}
