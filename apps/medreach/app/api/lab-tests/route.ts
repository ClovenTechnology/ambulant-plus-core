// apps/medreach/app/api/lab-tests/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
  upstreamNotImplemented,
} from '../_apigw';

export type LabTest = {
  labId: string;
  code: string;
  name: string;
  category?: string;
  sampleType?: string;
  priceZAR: number;
  etaDays: number;
  instructions?: string;
  referenceRange?: string;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toMinorUnits(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  return Math.round(n * 100);
}

function toTurnaroundHours(etaDays: unknown) {
  const n = Number(etaDays);

  if (!Number.isFinite(n) || n <= 0) return 24;

  return Math.round(n * 24);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const labId = cleanString(url.searchParams.get('labId'));

  if (!labId) {
    return badRequest('missing_labId');
  }

  const forwardedSearch = new URLSearchParams(url.searchParams);
  forwardedSearch.delete('labId');

  const path = `/api/medreach/labs/${encodeURIComponent(labId)}/tests`;

  const response = await proxyToGateway(req, {
    method: 'GET',
    path,
    searchParams: forwardedSearch,
    headers: {
      'x-lab-id': labId,
    },
  });

  if (response.status === 501) {
    return upstreamNotImplemented(path, 404);
  }

  return response;
}

export async function POST(req: NextRequest) {
  let body: Partial<LabTest>;

  try {
    body = (await req.json()) as Partial<LabTest>;
  } catch {
    return badRequest('invalid_json');
  }

  const labId = cleanString(body.labId);
  const code = cleanString(body.code);
  const name = cleanString(body.name);

  if (!labId) {
    return badRequest('missing_labId');
  }

  if (!code || !name) {
    return badRequest('missing_code_or_name');
  }

  const path = `/api/medreach/labs/${encodeURIComponent(labId)}/tests`;

  const response = await proxyToGateway(req, {
    method: 'POST',
    path,
    body: {
      code,
      name,
      category: cleanString(body.category) || undefined,
      specimenType: cleanString(body.sampleType) || undefined,
      sampleType: cleanString(body.sampleType) || undefined,
      priceMinor: toMinorUnits(body.priceZAR),
      currency: 'ZAR',
      turnaroundHours: toTurnaroundHours(body.etaDays),
      instructions: cleanString(body.instructions) || undefined,
      referenceRange: cleanString(body.referenceRange) || undefined,
      active: true,
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