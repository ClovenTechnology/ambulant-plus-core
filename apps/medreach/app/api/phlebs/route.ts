// apps/medreach/app/api/phlebs/route.ts
import { NextRequest } from 'next/server';
import {
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export type Phleb = {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  active: boolean;
  serviceRadiusKm?: number;
  serviceAreas?: string[];
  preferredLabs?: string[];
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = '/api/medreach/phlebs';

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