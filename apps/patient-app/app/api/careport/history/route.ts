// apps/patient-app/app/api/careport/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  forwardAuthHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeOrderToHistoryItem(order: any) {
  return {
    id: String(order.id),
    encId: order.encounterId ?? null,
    orderNo: order.id,
    status: order.status,
    createdAt: order.createdAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    pharmacyName: order.pharmacyName ?? order.chosenPharmacyName ?? order.pharmacy?.name ?? order.chosenPharmacy?.name ?? null,
    pharmacyTradingName: order.pharmacyTradingName ?? order.chosenPharmacyTradingName ?? order.pharmacy?.tradingName ?? order.chosenPharmacy?.tradingName ?? null,
    pharmacyRegisteredName: order.pharmacyRegisteredName ?? order.chosenPharmacyRegisteredName ?? order.pharmacy?.registeredName ?? order.chosenPharmacy?.registeredName ?? null,
    pharmacyLogoUrl: order.pharmacyLogoUrl ?? order.chosenPharmacyLogoUrl ?? order.pharmacy?.logoUrl ?? order.chosenPharmacy?.logoUrl ?? null,
    pharmacySapcNumber: order.pharmacySapcNumber ?? order.chosenPharmacySapcNumber ?? order.pharmacy?.sapcNumber ?? order.chosenPharmacy?.sapcNumber ?? null,
    riderName: order.riderName ?? order.assignedRiderName ?? order.rider?.name ?? order.assignedRider?.name ?? null,
    riderAvatarUrl: order.riderAvatarUrl ?? order.assignedRiderAvatarUrl ?? order.rider?.avatarUrl ?? order.assignedRider?.avatarUrl ?? null,
    riderVehicle: order.riderVehicle ?? order.assignedRiderVehicle ?? order.rider?.vehicle ?? order.assignedRider?.vehicle ?? null,
    riderRegPlate: order.riderRegPlate ?? order.assignedRiderRegPlate ?? order.rider?.regPlate ?? order.assignedRider?.regPlate ?? order.rider?.registration ?? order.assignedRider?.registration ?? null,
    total:
      typeof order.total === 'number'
        ? order.total
        : typeof order.totalCents === 'number'
          ? order.totalCents / 100
          : null,
    paymentMethod: order.paymentMethod ?? null,
    fulfillment: order.fulfillment ?? null,
    currency: order.currency ?? 'ZAR',
  };
}

export async function GET(req: NextRequest) {
  const base = getGatewayBase();

  if (!base) {
    return gatewayNotConfigured('careport');
  }

  const incoming = new URL(req.url);
  const encId =
    incoming.searchParams.get('encId') ||
    incoming.searchParams.get('encounterId') ||
    '';

  const upstream = new URL('/api/careport/orders', base);

  if (encId) upstream.searchParams.set('encounterId', encId);
  upstream.searchParams.set('limit', incoming.searchParams.get('limit') || '50');

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
    });

    const data = await readJsonResponse(res);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || `careport_gateway_http_${res.status}`,
          items: [],
        },
        { status: res.status },
      );
    }

    const orders = Array.isArray(data?.orders)
      ? data.orders
      : Array.isArray(data?.items)
        ? data.items
        : [];

    return NextResponse.json(
      {
        ok: true,
        items: orders.map(normalizeOrderToHistoryItem),
        source: 'api_gateway',
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'careport_history_proxy_failed',
        items: [],
      },
      { status: 502 },
    );
  }
}