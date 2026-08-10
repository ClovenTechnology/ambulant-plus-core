import { NextRequest } from 'next/server';
import { proxyAdminBinaryGET, proxyAdminJsonBody } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminBinaryGET(request, {
    path: `/api/admin/staff/${encodeURIComponent(context.params.id)}/avatar`,
  });
}
export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'DELETE', {
    path: `/api/admin/staff/${encodeURIComponent(context.params.id)}/avatar`,
  });
}
