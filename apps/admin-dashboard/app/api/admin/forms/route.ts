import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyAdminJsonGET(request, { path: '/api/admin/forms' });
}

export async function POST(request: NextRequest) {
  return proxyAdminJsonBody(request, 'POST', { path: '/api/admin/forms' });
}
