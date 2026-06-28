// apps/medreach/app/api/lab-orders/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
} from '../_apigw';

type LegacyStatus =
  | 'WAITING_LAB_SELECTION'
  | 'WAITING_PHLEB'
  | 'PHLEB_EN_ROUTE_TO_PATIENT'
  | 'PHLEB_ARRIVED'
  | 'SAMPLING_IN_PROGRESS'
  | 'PHLEB_EN_ROUTE_TO_LAB'
  | 'DELIVERED_TO_LAB';

type LabResultStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';

type PatchBody =
  | {
      orderId: string;
      action: 'accept';
      labId: string;
    }
  | {
      orderId: string;
      action: 'decline';
      labId: string;
    }
  | {
      orderId: string;
      action: 'updateStatus';
      status: LegacyStatus | string;
    }
  | {
      orderId: string;
      action: 'markReceivedAtLab';
      receivedAtLabAt?: string;
    }
  | {
      orderId: string;
      action: 'markAccepted';
      acceptedAt?: string;
    }
  | {
      orderId: string;
      action: 'markRejected';
      rejectedAt?: string;
      rejectionReason?: string;
    }
  | {
      orderId: string;
      action: 'linkSpecimenBundle';
      specimenBundleId: string;
    }
  | {
      orderId: string;
      action: 'updateResult';
      resultStatus: LabResultStatus;
      resultSummary?: string;
      resultPdfUrl?: string;
      testResults?: unknown[];
    };

function mapLegacyDrawStatus(status: string) {
  const value = String(status || '').trim();

  const map: Record<string, string> = {
    WAITING_LAB_SELECTION: 'MARKETPLACE_OPEN',
    WAITING_PHLEB: 'ASSIGNED',
    PHLEB_EN_ROUTE_TO_PATIENT: 'EN_ROUTE',
    PHLEB_ARRIVED: 'ARRIVED',
    SAMPLING_IN_PROGRESS: 'SPECIMEN_COLLECTED',
    PHLEB_EN_ROUTE_TO_LAB: 'IN_TRANSIT_TO_LAB',
    DELIVERED_TO_LAB: 'RECEIVED_AT_LAB',
  };

  return map[value] || value;
}

function cleanLabIdFromBody(body: unknown) {
  if (!body || typeof body !== 'object') return '';

  const value = (body as Record<string, unknown>).labId;

  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const labId = url.searchParams.get('labId')?.trim();

  if (!labId) {
    return badRequest('missing_labId');
  }

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

export async function PATCH(req: NextRequest) {
  let body: PatchBody;

  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return badRequest('invalid_json');
  }

  const orderId =
    body && typeof body === 'object' && typeof body.orderId === 'string'
      ? body.orderId.trim()
      : '';

  if (!orderId) {
    return badRequest('missing_orderId');
  }

  if (!body.action) {
    return badRequest('missing_action');
  }

  const labId = cleanLabIdFromBody(body);

  const gatewayBody =
    body.action === 'updateStatus'
      ? {
          ...body,
          status: mapLegacyDrawStatus(String(body.status || '')),
        }
      : body;

  return proxyToGateway(req, {
    method: 'PATCH',
    path: `/api/medreach/labs/orders/${encodeURIComponent(orderId)}`,
    body: gatewayBody,
    headers: {
      'x-lab-id': labId || undefined,
    },
  });
}