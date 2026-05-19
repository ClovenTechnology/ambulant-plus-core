// apps/patient-app/app/api/medreach/jobs/route.ts
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

export async function GET(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return json(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_jobs',
        jobs: [],
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const upstream = new URL('/api/medreach/orders', base);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      return json(
        {
          ok: false,
          error: 'medreach_jobs_service_not_configured',
          jobs: [],
        },
        503,
      );
    }

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: data?.error || `medreach_gateway_http_${res.status}`,
          jobs: [],
        },
        res.status,
      );
    }

    const orders = Array.isArray(data?.orders)
      ? data.orders
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

    const id = incoming.searchParams.get('id');
    const status = incoming.searchParams.get('status');

    let jobs = orders.map(normalizeOrderToJob).filter((j: any) => j.id);

    if (id) {
      jobs = jobs.filter((j: any) => j.id === id || j.orderId === id);
    }

    if (status) {
      const s = status.toLowerCase();
      jobs = jobs.filter((j: any) => String(j.status || '').toLowerCase() === s);
    }

    return json({
      ok: true,
      jobs,
      source: 'api_gateway',
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'medreach_jobs_proxy_failed',
        jobs: [],
      },
      502,
    );
  }
}