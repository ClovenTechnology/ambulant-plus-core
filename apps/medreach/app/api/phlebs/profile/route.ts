// apps/medreach/app/api/phlebs/profile/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../../_apigw';

export type PhlebProfile = {
  phlebId: string;
  fullName: string;
  dob: string;
  gender?: string;
  qualification?: string;
  email: string;
  basePhone?: string;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = cleanString(url.searchParams.get('phlebId'));

  if (!phlebId) {
    return badRequest('missing_phlebId');
  }

  const path = `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`;

  const response = await proxyToGateway(req, {
    method: 'GET',
    path,
    headers: {
      'x-actor-ref-id': phlebId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}