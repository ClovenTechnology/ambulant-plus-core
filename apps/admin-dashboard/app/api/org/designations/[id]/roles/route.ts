import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'PUT', { path: `/api/org/designations/${encodeURIComponent(params.id)}/roles` });
}
