// apps/medreach/app/api/lab-reviews/[reviewId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyGateway } from '../../lab-networks/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { reviewId: string } },
) {
  const reviewId = clean(params.reviewId);

  if (!reviewId) {
    return NextResponse.json({ ok: false, error: 'missing_reviewId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-reviews/${encodeURIComponent(reviewId)}`,
    'GET',
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { reviewId: string } },
) {
  const reviewId = clean(params.reviewId);

  if (!reviewId) {
    return NextResponse.json({ ok: false, error: 'missing_reviewId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-reviews/${encodeURIComponent(reviewId)}`,
    'PATCH',
  );
}