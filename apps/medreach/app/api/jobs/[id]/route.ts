// apps/medreach/app/api/jobs/[id]/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../../_apigw';

type Body = {
  status?: string;
  labId?: string;
  phlebId?: string;
  bundleId?: string;
  specimenId?: string;
  lat?: number;
  lng?: number;
  note?: string;
  correlationId?: string;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapDisplayStatusToLegacyStatus(status: string) {
  const value = status.trim();

  const map: Record<string, string> = {
    Assigned: 'WAITING_PHLEB',
    'En route': 'PHLEB_EN_ROUTE_TO_PATIENT',
    Arrived: 'PHLEB_ARRIVED',
    'Sample collected': 'SAMPLING_IN_PROGRESS',
    'Delivered to lab': 'DELIVERED_TO_LAB',
  };

  return map[value] || value;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = cleanString(params.id);
  const url = new URL(req.url);
  const labId = url.searchParams.get('labId')?.trim();

  if (!jobId) {
    return badRequest('missing_job_id');
  }

  if (!labId) {
    return upstreamNotImplemented('/api/medreach/jobs/[id]', 404);
  }

  const response = await proxyToGateway(req, {
    method: 'GET',
    path: `/api/medreach/labs/${encodeURIComponent(labId)}/orders`,
    headers: {
      'x-lab-id': labId,
    },
  });

  return response;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = cleanString(params.id);

  if (!jobId) {
    return badRequest('missing_job_id');
  }

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('invalid_json');
  }

  const status = cleanString(body.status);

  if (!status) {
    return badRequest('missing_status');
  }

  const legacyStatus = mapDisplayStatusToLegacyStatus(status);

  return proxyToGateway(req, {
    method: 'PATCH',
    path: '/api/jobs/status',
    body: {
      jobId,
      orderId: jobId,
      status: legacyStatus,
      labId: cleanString(body.labId) || undefined,
      phlebId: cleanString(body.phlebId) || undefined,
      bundleId: cleanString(body.bundleId) || undefined,
      specimenId: cleanString(body.specimenId) || undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lng: typeof body.lng === 'number' ? body.lng : undefined,
      note: cleanString(body.note) || undefined,
      correlationId: cleanString(body.correlationId) || undefined,
    },
  });
}