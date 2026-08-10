import { NextRequest } from 'next/server';
import { proxyAdminBinaryGET, proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  return proxyAdminBinaryGET(request, {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/gallery/${encodeURIComponent(context.params.imageId)}`,
  });
}

export async function PATCH(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/gallery/${encodeURIComponent(context.params.imageId)}`,
  });
}

export async function DELETE(request: NextRequest, context: { params: { id: string; imageId: string } }) {
  return proxyAdminJsonBody(request, 'DELETE', {
    path: `/api/admin/opportunities/${encodeURIComponent(context.params.id)}/gallery/${encodeURIComponent(context.params.imageId)}`,
  });
}
