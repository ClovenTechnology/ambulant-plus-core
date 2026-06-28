// apps/medreach/app/api/metrics/route.ts
import { NextRequest } from 'next/server';
import {
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = '/api/medreach/metrics';

  const response = await proxyToGateway(req, {
    method: 'GET',
    path,
    searchParams: url.searchParams,
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}