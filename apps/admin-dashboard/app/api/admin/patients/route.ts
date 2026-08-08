import { NextRequest } from 'next/server';
import { proxyAdminJsonGET } from '@/app/api/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyAdminJsonGET(req, { path: '/api/admin/patients' });
}
