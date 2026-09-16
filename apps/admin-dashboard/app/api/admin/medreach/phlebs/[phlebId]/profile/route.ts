import { withPartnerAdminProxy } from '@/lib/partner-admin-proxy';
// apps/admin-dashboard/app/api/admin/medreach/phlebs/[phlebId]/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyJson, readJson } from '../../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const phlebId = clean(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  return proxyJson(req, {
    method: 'GET',
    path: `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`,
    headers: {
      'x-actor-ref-id': phlebId,
    },
  });
}

async function partnerOriginalPATCH(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const phlebId = clean(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const body = await readJson(req);

  return proxyJson(req, {
    method: 'PATCH',
    path: `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`,
    body,
    headers: {
      'x-actor-ref-id': phlebId,
    },
  });
}
export const GET = withPartnerAdminProxy(partnerOriginalGET);
export const PATCH = withPartnerAdminProxy(partnerOriginalPATCH);
