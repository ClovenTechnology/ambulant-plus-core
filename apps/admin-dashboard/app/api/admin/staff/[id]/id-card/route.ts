import { NextRequest } from 'next/server';
import { proxyAdminBinaryGET } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { id: string } }) { return proxyAdminBinaryGET(request, { path: `/api/admin/staff/${encodeURIComponent(params.id)}/id-card`, forwardQuery: false }); }
