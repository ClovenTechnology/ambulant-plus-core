// apps/medreach/app/api/timeline/route.ts
import { NextRequest } from 'next/server';
import { badRequest, upstreamNotImplemented } from '../_apigw';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  const orderId = url.searchParams.get('orderId')?.trim() || id;
  const drawId = url.searchParams.get('drawId')?.trim();
  const bundleId = url.searchParams.get('bundleId')?.trim();

  if (!orderId && !drawId && !bundleId) {
    return badRequest('missing_orderId_drawId_or_bundleId');
  }

  return upstreamNotImplemented('/api/medreach/timeline', 404);
}