// apps/patient-app/app/api/medreach/reports/route.ts
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

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function isCompletedStatus(value: unknown) {
  const status = clean(value, 80).toLowerCase();

  return (
    status === 'completed' ||
    status === 'sent' ||
    status === 'ready' ||
    status === 'result available' ||
    status === 'result sent' ||
    status === 'result_sent' ||
    status === 'result_sent_to_patient'
  );
}

function normalizeListedLab(row: any) {
  const rawReference = clean(row.reference || row.orderId || row.ref || row.id, 160);
  const orderId = rawReference.startsWith('order_') ? rawReference.slice('order_'.length) : rawReference;

  return {
    id: row.id || orderId,
    orderId,
    encounterId: row.encounterId ?? null,
    patientId: row.patientId ?? null,
    patient: row.patientName ?? '',
    type: row.panel || row.test || 'Lab report',
    createdAt: row.date || row.createdAt || null,
    resultStatus: row.resultStatus || (isCompletedStatus(row.status) ? 'SENT' : 'PENDING'),
    resultSummary: row.resultSummary || row.result || null,
    resultPdfUrl: row.resultPdfUrl || row.downloadUrl || null,
    testResults: Array.isArray(row.testResults)
      ? row.testResults
      : row.test
        ? [
            {
              name: row.test,
              value: row.result || row.value || '',
              unit: row.unit || '',
              referenceRange: row.referenceRange || row.ref || '',
              flag: row.flag || '',
            },
          ]
        : [],
    source: row.source || 'patient-app.api.labs',
  };
}

function normalizeReport(order: any) {
  return {
    id: order.id ?? order.orderId,
    orderId: order.id ?? order.orderId,
    encounterId: order.encounterId ?? null,
    patientId: order.patientId ?? null,
    patient: order.patientName ?? '',
    type:
      Array.isArray(order.tests) && order.tests.length
        ? order.tests.map((t: any) => t.name || t.code).filter(Boolean).join(', ')
        : 'Lab report',
    createdAt: order.resultReadyAt ?? order.resultSentAt ?? order.createdAt ?? null,
    resultStatus: order.resultStatus ?? null,
    resultSummary: order.resultSummary ?? null,
    resultPdfUrl: order.resultPdfUrl ?? null,
    testResults: Array.isArray(order.testResults) ? order.testResults : [],
  };
}

export async function GET(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return json(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_reports',
        reports: [],
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const orderId =
    incoming.searchParams.get('orderId') ||
    incoming.searchParams.get('id') ||
    incoming.searchParams.get('encId') ||
    '';

  if (!orderId) {
    return json(
      {
        ok: true,
        reports: [],
        source: 'api_gateway',
      },
      200,
    );
  }

  const upstream = new URL(`/api/medreach/labs/orders/${encodeURIComponent(orderId)}`, base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      return json({ ok: true, reports: [], source: 'api_gateway' }, 200);
    }

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: data?.error || `medreach_gateway_http_${res.status}`,
          reports: [],
        },
        res.status,
      );
    }

    const order = data?.data ?? data?.order ?? data;

    return json({
      ok: true,
      reports: [normalizeReport(order)].filter((r) => r.id),
      source: 'api_gateway',
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'medreach_reports_proxy_failed',
        reports: [],
      },
      502,
    );
  }
}