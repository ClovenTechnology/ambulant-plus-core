// apps/admin-dashboard/app/api/admin/medreach/phlebs/[phlebId]/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyJson, readJson } from '../../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
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

export async function PATCH(
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