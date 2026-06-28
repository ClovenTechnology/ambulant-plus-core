// apps/medreach/app/api/phleb-jobs/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = url.searchParams.get('phlebId')?.trim();

  if (!phlebId) {
    return badRequest('missing_phlebId');
  }

  const forwardedSearch = new URLSearchParams(url.searchParams);

  forwardedSearch.delete('phlebId');

  const path = `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/jobs`;

  const response = await proxyToGateway(req, {
    method: 'GET',
    path,
    searchParams: forwardedSearch,
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}