import { NextRequest } from 'next/server';
import { proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyAdminJsonGET(request, {
    path: `/api/admin/staff/${encodeURIComponent(params.id)}/activity`,
    forwardQuery: true,
  });
}
