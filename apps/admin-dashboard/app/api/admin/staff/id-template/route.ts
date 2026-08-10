import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return proxyAdminJsonGET(request, { path: '/api/admin/staff/id-template', forwardQuery: false }); }
export async function PATCH(request: NextRequest) { return proxyAdminJsonBody(request, 'PATCH', { path: '/api/admin/staff/id-template' }); }
