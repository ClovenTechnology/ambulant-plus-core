import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const before = request.nextUrl.searchParams.get('before');
  const suffix = before ? `?before=${encodeURIComponent(before)}` : '';
  return proxyAdminJsonGET(request, {
    path: `/api/admin/communications/conversations/${encodeURIComponent(params.id)}${suffix}`,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: `/api/admin/communications/conversations/${encodeURIComponent(params.id)}`,
  });
}
