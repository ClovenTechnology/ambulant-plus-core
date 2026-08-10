import { NextRequest } from 'next/server';
import { proxyAdminJsonBody } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return proxyAdminJsonBody(request, 'POST', { path: '/api/admin/staff/id-template/image/confirm' }); }
