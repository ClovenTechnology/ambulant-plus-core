import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/meetings/${encodeURIComponent(params.id)}/chat`,
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonBody(request, 'POST', {
    path: `/api/admin/meetings/${encodeURIComponent(params.id)}/chat`,
  });
}
