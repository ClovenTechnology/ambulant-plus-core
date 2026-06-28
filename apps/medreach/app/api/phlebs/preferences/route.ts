// apps/medreach/app/api/phlebs/preferences/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../../_apigw';

export type PhlebPreferences = {
  phlebId: string;
  avatarUrl?: string;
  contactPhone?: string;
  serviceAreas: string[];
  preferredLabIds: string[];
  vehicle: {
    make: string;
    model: string;
    registration: string;
    color?: string;
    type?: string;
    changePending?: boolean;
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

  const path = `/api/medreach/phlebs/${encodeURIComponent(
    phlebId,
  )}/preferences`;

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

export async function PATCH(req: NextRequest) {
  let body: Partial<PhlebPreferences> & { phlebId?: string };

  try {
    body = (await req.json()) as Partial<PhlebPreferences> & {
      phlebId?: string;
    };
  } catch {
    return badRequest('invalid_json');
  }

  const phlebId = cleanString(body.phlebId);

  if (!phlebId) {
    return badRequest('missing_phlebId');
  }

  const path = `/api/medreach/phlebs/${encodeURIComponent(
    phlebId,
  )}/preferences`;

  const response = await proxyToGateway(req, {
    method: 'PATCH',
    path,
    body: {
      avatarUrl: cleanString(body.avatarUrl) || undefined,
      contactPhone: cleanString(body.contactPhone) || undefined,
      serviceAreas: Array.isArray(body.serviceAreas) ? body.serviceAreas : [],
      preferredLabIds: Array.isArray(body.preferredLabIds)
        ? body.preferredLabIds
        : [],
      vehicle: body.vehicle || undefined,
    },
    headers: {
      'x-actor-ref-id': phlebId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}