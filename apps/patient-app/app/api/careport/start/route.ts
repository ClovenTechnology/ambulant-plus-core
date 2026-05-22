// FILE: apps/patient-app/app/api/careport/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  forwardJsonHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeFulfillment(v: unknown): 'DELIVERY' | 'PICKUP' {
  return String(v || '').toUpperCase() === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
}

function asBool(v: unknown, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

export async function POST(req: NextRequest) {
  const gatewayBase = getGatewayBase();

  if (!gatewayBase) {
    return gatewayNotConfigured('careport_start');
  }

  const body = (await req.json().catch(() => ({}))) ?? {};

  const fulfillment = normalizeFulfillment(body.fulfillment);
  const destination = body.destination ?? null;

  const encId = cleanString(body.encId || body.encounterId);
  const erxOrderId = cleanString(body.erxOrderId || body.scriptId);
  const refillNo = Number.isFinite(Number(body.refillNo)) ? Number(body.refillNo) : 0;

  if (!encId && !erxOrderId) {
    return NextResponse.json(
      { ok: false, error: 'encId_or_erxOrderId_required' },
      { status: 400 },
    );
  }

  if (fulfillment === 'DELIVERY') {
    const addr = cleanString(destination?.addr);
    const lat = Number(destination?.lat);
    const lng = Number(destination?.lng);

    if (!addr || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { ok: false, error: 'destination_required_for_delivery' },
        { status: 400 },
      );
    }
  }

  const payload = {
    encId: encId || undefined,
    erxOrderId: erxOrderId || undefined,
    refillNo,
    fulfillment,
    destination: fulfillment === 'DELIVERY' ? destination : undefined,

    initiatedByRole: 'patient',
    initiatedByUserId:
      req.headers.get('x-uid') ||
      req.headers.get('x-user-id') ||
      req.headers.get('x-ambulant-user-id') ||
      undefined,
    createdFromApp: 'patient-app',

    clientId: cleanString(body.clientId) || undefined,
    clientMemberId: cleanString(body.clientMemberId) || undefined,
    coveragePlanId: cleanString(body.coveragePlanId) || undefined,
    coverageAuthorizationId: cleanString(body.coverageAuthorizationId) || undefined,

    sponsorRequested: asBool(body.sponsorRequested, false),
    allowPartialFulfillment: asBool(body.allowPartialFulfillment, false),
    allowGenericSubstitution: asBool(body.allowGenericSubstitution, true),

    preferredPaymentMethod: cleanString(body.preferredPaymentMethod) || undefined,
    gapPaymentMethod: cleanString(body.gapPaymentMethod) || undefined,

    sponsorPricingSnapshot: body.sponsorPricingSnapshot ?? undefined,
    metadata: {
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      fulfillmentConfirmedAt: new Date().toISOString(),
      destinationConfirmed: fulfillment === 'DELIVERY',
      source: 'patient-app-careport',
    },
  };

  const upstream = new URL('/api/careport/orders/push', gatewayBase);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardJsonHeaders(req),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await readJsonResponse(res);

    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to start CarePort marketplace.';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
