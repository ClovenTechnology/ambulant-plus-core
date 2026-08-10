import { NextRequest } from 'next/server';
import { proxyAdminBinaryGET, proxyAdminJsonBody } from '@/app/api/_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { id: string; documentId: string } }) { return proxyAdminBinaryGET(request, { path: `/api/admin/staff/${encodeURIComponent(params.id)}/documents/${encodeURIComponent(params.documentId)}/download`, forwardQuery: false }); }
export async function DELETE(request: NextRequest, { params }: { params: { id: string; documentId: string } }) { return proxyAdminJsonBody(request, 'DELETE', { path: `/api/admin/staff/${encodeURIComponent(params.id)}/documents/${encodeURIComponent(params.documentId)}/download` }); }
