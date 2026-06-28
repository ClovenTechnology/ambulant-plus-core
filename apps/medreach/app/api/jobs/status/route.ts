// apps/medreach/app/api/jobs/status/route.ts
import { NextRequest } from 'next/server';
import {
  badRequest,
  proxyToGateway,
} from '../../_apigw';

type LegacyStatus =
  | 'WAITING_LAB_SELECTION'
  | 'WAITING_PHLEB'
  | 'PHLEB_EN_ROUTE_TO_PATIENT'
  | 'PHLEB_ARRIVED'
  | 'SAMPLING_IN_PROGRESS'
  | 'PHLEB_EN_ROUTE_TO_LAB'
  | 'DELIVERED_TO_LAB';

type Body = {
  jobId?: string;
  orderId?: string;
  drawId?: string;
  bundleId?: string;
  specimenId?: string;
  status?: LegacyStatus | string;

  phlebId?: string;
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  partnerId?: string;
  scheduledAt?: string;

  lat?: number;
  lng?: number;
  note?: string;
  correlationId?: string;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function custodyActionForStatus(status: string) {
  const value = String(status || '').trim();

  const map: Record<string, string> = {
    SAMPLING_IN_PROGRESS: 'COLLECTED',
    PHLEB_EN_ROUTE_TO_LAB: 'IN_TRANSIT',
    DELIVERED_TO_LAB: 'ARRIVED_AT_LAB',
  };

  return map[value] || '';
}

function shouldUseCustody(status: string) {
  return Boolean(custodyActionForStatus(status));
}

export async function PATCH(req: NextRequest) {
  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('invalid_json');
  }

  const orderId = cleanString(body.orderId || body.jobId);
  const status = cleanString(body.status);

  if (!orderId || !status) {
    return badRequest('missing_orderId_or_status');
  }

  if (status === 'WAITING_PHLEB') {
    const phlebId = cleanString(body.phlebId);
    const encounterId = cleanString(body.encounterId);
    const patientId = cleanString(body.patientId);

    if (!phlebId || !encounterId || !patientId) {
      return badRequest('assignment_requires_phlebId_encounterId_patientId', {
        required: ['phlebId', 'encounterId', 'patientId'],
      });
    }

    return proxyToGateway(req, {
      method: 'POST',
      path: '/api/medreach/assign',
      body: {
        orderId,
        phlebId,
        encounterId,
        patientId,
        clinicianId: cleanString(body.clinicianId) || undefined,
        partnerId: cleanString(body.partnerId) || undefined,
        scheduledAt: cleanString(body.scheduledAt) || undefined,
      },
    });
  }

  if (shouldUseCustody(status)) {
    const bundleId = cleanString(body.bundleId);

    if (!bundleId) {
      return badRequest('custody_status_requires_bundleId', {
        status,
        orderId,
        required: ['bundleId'],
      });
    }

    const action = custodyActionForStatus(status);

    return proxyToGateway(req, {
      method: 'POST',
      path: `/api/medreach/bundles/${encodeURIComponent(bundleId)}/custody`,
      body: {
        action,
        specimenId: cleanString(body.specimenId) || null,
        lat: typeof body.lat === 'number' ? body.lat : null,
        lng: typeof body.lng === 'number' ? body.lng : null,
        correlationId: cleanString(body.correlationId) || undefined,
        meta: {
          orderId,
          legacyStatus: status,
          note: cleanString(body.note) || undefined,
        },
      },
    });
  }

  return proxyToGateway(req, {
    method: 'PATCH',
    path: `/api/medreach/labs/orders/${encodeURIComponent(orderId)}`,
    body: {
      action: 'updateStatus',
      status: mapLegacyDrawStatus(status),
    },
  });
}