// apps/patient-app/app/api/medreach/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  const passthrough = [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  if (!headers.has('x-role')) {
    headers.set('x-role', 'patient');
  }

  headers.set('accept', 'application/json');

  return headers;
}

function normalizeOrderToJob(order: any) {
  return {
    id: String(order.id ?? order.orderId ?? ''),
    orderId: String(order.id ?? order.orderId ?? ''),
    patient: order.patientName ?? order.patient?.name ?? order.patientId ?? '',
    patientId: order.patientId ?? null,
    encounterId: order.encounterId ?? null,
    clinicianId: order.clinicianId ?? null,
    address: order.patientAddress ?? order.destinationAddress ?? order.address ?? '',
    collectionWindow:
      order.collectionWindowLabel ??
      order.collectionWindow ??
      order.collectionTime ??
      null,
    status: order.status ?? order.drawStatus ?? order.resultStatus ?? 'PENDING',
    eta: order.eta ?? null,
    tests: order.tests ?? [],
    panels: order.panels ?? [],
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    coords:
      order.destinationLat != null && order.destinationLng != null
        ? {
            patient: {
              lat: Number(order.destinationLat),
              lng: Number(order.destinationLng),
            },
          }
        : undefined,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = String(context.params.id || '').trim();

  if (!id) {
    return json({ ok: false, error: 'id_required' }, 400);
  }

  const base = apigwBase();

  if (!base) {
    return json(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_job_detail',
      },
      503,
    );
  }

  /*
   * Preferred gateway path if present. If not present, fall back to querying
   * the orders list by id/orderId. No local mock/in-memory fallback.
   */
  const direct = new URL(`/api/medreach/orders/${encodeURIComponent(id)}`, base);

  try {
    const directRes = await fetch(direct.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const directData = await directRes.json().catch(() => ({}));

    if (directRes.ok) {
      const order = directData?.order ?? directData?.data ?? directData;
      return json({
        ok: true,
        job: normalizeOrderToJob(order),
        source: 'api_gateway',
      });
    }

    if (directRes.status !== 404) {
      return json(
        {
          ok: false,
          error: directData?.error || `medreach_gateway_http_${directRes.status}`,
        },
        directRes.status,
      );
    }

    const list = new URL('/api/medreach/orders', base);
    list.searchParams.set('id', id);

    const listRes = await fetch(list.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const listData = await listRes.json().catch(() => ({}));

    if (!listRes.ok) {
      return json(
        {
          ok: false,
          error: listData?.error || `medreach_gateway_http_${listRes.status}`,
        },
        listRes.status,
      );
    }

    const orders = Array.isArray(listData?.orders)
      ? listData.orders
      : Array.isArray(listData?.items)
        ? listData.items
        : Array.isArray(listData?.data)
          ? listData.data
          : [];

    const match =
      orders.find((o: any) => String(o.id ?? o.orderId ?? '') === id) ?? null;

    if (!match) {
      return json({ ok: false, error: 'job_not_found' }, 404);
    }

    return json({
      ok: true,
      job: normalizeOrderToJob(match),
      source: 'api_gateway',
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'medreach_job_detail_proxy_failed',
      },
      502,
    );
  }
}