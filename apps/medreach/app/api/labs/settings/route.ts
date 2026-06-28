// apps/medreach/app/api/labs/settings/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../../_apigw';

export type LabSettings = {
  labId: string;
  name: string;
  primaryPhone?: string;
  additionalPhones?: string[];
  primaryEmail?: string;
  additionalEmails?: string[];
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  logoUrl?: string;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const labId = cleanString(url.searchParams.get('labId'));

  if (!labId) {
    return badRequest('missing_labId');
  }

  const path = `/api/medreach/labs/${encodeURIComponent(labId)}`;

  const response = await proxyToGateway(req, {
    method: 'GET',
    path,
    headers: {
      'x-lab-id': labId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}

export async function PATCH(req: NextRequest) {
  let body: Partial<LabSettings> & { labId?: string };

  try {
    body = (await req.json()) as Partial<LabSettings> & { labId?: string };
  } catch {
    return badRequest('invalid_json');
  }

  const labId = cleanString(body.labId);

  if (!labId) {
    return badRequest('missing_labId');
  }

  const path = `/api/medreach/labs/${encodeURIComponent(labId)}`;

  const response = await proxyToGateway(req, {
    method: 'PATCH',
    path,
    body: {
      name: cleanString(body.name) || undefined,
      primaryPhone: cleanString(body.primaryPhone) || undefined,
      additionalPhones: Array.isArray(body.additionalPhones)
        ? body.additionalPhones
        : [],
      primaryEmail: cleanString(body.primaryEmail) || undefined,
      additionalEmails: Array.isArray(body.additionalEmails)
        ? body.additionalEmails
        : [],
      addressLine1: cleanString(body.addressLine1) || undefined,
      addressLine2: cleanString(body.addressLine2) || undefined,
      city: cleanString(body.city) || undefined,
      province: cleanString(body.province) || undefined,
      postalCode: cleanString(body.postalCode) || undefined,
      logoUrl: cleanString(body.logoUrl) || undefined,
    },
    headers: {
      'x-lab-id': labId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}