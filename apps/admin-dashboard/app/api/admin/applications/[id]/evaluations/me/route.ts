import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

function path(id: string) {
  return `/api/admin/applications/${encodeURIComponent(id)}/evaluations/me`;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return proxyAdminJsonBody(request, 'PATCH', { path: path(context.params.id) });
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return proxyAdminJsonBody(request, 'POST', { path: path(context.params.id) });
}
