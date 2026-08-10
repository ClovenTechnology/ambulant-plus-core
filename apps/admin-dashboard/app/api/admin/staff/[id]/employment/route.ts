import { NextRequest } from 'next/server';
import { proxyAdminJsonBody, proxyAdminJsonGET } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { id: string } }) { return proxyAdminJsonGET(request, { path: `/api/admin/staff/${encodeURIComponent(params.id)}/employment`, forwardQuery: false }); }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) { return proxyAdminJsonBody(request, 'PATCH', { path: `/api/admin/staff/${encodeURIComponent(params.id)}/employment` }); }
