import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}`,
  });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}`,
  });
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'DELETE', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}`,
  });
}
