// apps/medreach/app/api/labs/[labId]/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../../_apigw';

export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const labId = String(params.labId || '').trim();

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const labId = String(params.labId || '').trim();

  if (!labId) {
    return badRequest('missing_labId');
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  const path = `/api/medreach/labs/${encodeURIComponent(labId)}`;

  const response = await proxyToGateway(req, {
    method: 'PATCH',
    path,
    body,
    headers: {
      'x-lab-id': labId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}