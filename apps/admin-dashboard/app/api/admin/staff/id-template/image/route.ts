import { NextRequest } from 'next/server';
import { proxyAdminBinaryGET } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return proxyAdminBinaryGET(request, { path: '/api/admin/staff/id-template/image', forwardQuery: false }); }
