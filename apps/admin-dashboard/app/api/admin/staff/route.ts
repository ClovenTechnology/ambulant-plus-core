import { NextRequest } from 'next/server';
import { proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyAdminJsonGET(request, { path: '/api/admin/staff' });
}
