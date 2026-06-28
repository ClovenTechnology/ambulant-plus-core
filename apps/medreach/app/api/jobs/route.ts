// apps/medreach/app/api/jobs/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = url.searchParams.get('phlebId')?.trim();
  const labId = url.searchParams.get('labId')?.trim();

  if (phlebId) {
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

  if (labId) {
    const forwardedSearch = new URLSearchParams(url.searchParams);
    forwardedSearch.delete('labId');

    return proxyToGateway(req, {
      method: 'GET',
      path: `/api/medreach/labs/${encodeURIComponent(labId)}/orders`,
      searchParams: forwardedSearch,
      headers: {
        'x-lab-id': labId,
      },
    });
  }

  return badRequest('missing_phlebId_or_labId');
}