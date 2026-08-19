import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'PATCH', { path: `/api/org/designations/${encodeURIComponent(params.id)}` });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'DELETE', { path: `/api/org/designations/${encodeURIComponent(params.id)}` });
}
