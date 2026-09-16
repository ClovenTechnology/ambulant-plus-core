import { withPartnerAdminProxy } from '@/lib/partner-admin-proxy';
// apps/admin-dashboard/app/api/admin/medreach/labs/[labId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyJson, readJson } from '../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const labId = clean(params.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  return proxyJson(req, {
    method: 'GET',
    path: `/api/medreach/labs/${encodeURIComponent(labId)}`,
    headers: {
      'x-lab-id': labId,
    },
  });
}

async function partnerOriginalPATCH(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const labId = clean(params.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const body = await readJson(req);

  return proxyJson(req, {
    method: 'PATCH',
    path: `/api/medreach/labs/${encodeURIComponent(labId)}`,
    body,
    headers: {
      'x-lab-id': labId,
    },
  });
}
export const GET = withPartnerAdminProxy(partnerOriginalGET);
export const PATCH = withPartnerAdminProxy(partnerOriginalPATCH);
