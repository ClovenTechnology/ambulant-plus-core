// apps/medreach/app/api/phleb-profile/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export type PhlebProfile = {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  email: string;
  primaryQualification: string;
  additionalQualifications?: string;
  profileImageUrl?: string;
  phone: string;
  address: string;
  serviceAreas: string[];
  preferredLabs: string[];
  vehicle: {
    make: string;
    model?: string;
    regNumber: string;
    color?: string;
    type?: string;
  };
  payoutDetails: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    branchCode?: string;
    payoutMethod?: string;
  };
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

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = cleanString(url.searchParams.get('phlebId'));

  if (!phlebId) {
    return badRequest('missing_phlebId');
  }

  let body: Partial<PhlebProfile>;

  try {
    body = (await req.json()) as Partial<PhlebProfile>;
  } catch {
    return badRequest('invalid_json');
  }

  const path = `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`;

  const response = await proxyToGateway(req, {
    method: 'PATCH',
    path,
    body,
    headers: {
      'x-actor-ref-id': phlebId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}