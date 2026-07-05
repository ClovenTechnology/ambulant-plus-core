// apps/patient-app/app/api/encounters/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  return configured ? trimSlash(configured) : '';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, includeJson = false) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (includeJson) headers.set('content-type', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeEncounter(row: any) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || row.encounterId || '').trim();
  if (!id) return null;

  return {
    ...row,
    id,
    caseId: row.caseId || row.case_id || row.patientCaseId || `encounter-${id}`,
    status: row.status || 'open',
    visitMode: row.visitMode || row.mode || row.type || row.appointment?.visitMode || null,
    primaryTime:
      row.primaryTime ||
      row.endedAt ||
      row.stop ||
      row.consultationEndedAt ||
      row.startedAt ||
      row.start ||
      row.consultationStartedAt ||
      row.updatedAt ||
      row.createdAt ||
      null,
    start: row.start || row.startedAt || row.consultationStartedAt || row.createdAt || null,
    stop: row.stop || row.endedAt || row.consultationEndedAt || null,
    startedAt: row.startedAt || row.start || row.consultationStartedAt || null,
    endedAt: row.endedAt || row.stop || row.consultationEndedAt || null,
    clinician: row.clinician || (row.clinicianId ? { id: row.clinicianId, name: row.clinicianName || 'Clinician' } : null),
    documents: Array.isArray(row.documents) ? row.documents : [],
    erxOrders: Array.isArray(row.erxOrders) ? row.erxOrders : [],
    labOrders: Array.isArray(row.labOrders) ? row.labOrders : [],
    counts: row.counts || {},
  };
}

function unwrapEncounter(payload: any, id: string) {
  const direct = normalizeEncounter(payload?.encounter ?? payload?.item ?? payload);
  if (direct?.id === id) return direct;

  const fromEncounters = Array.isArray(payload?.encounters)
    ? payload.encounters.map(normalizeEncounter).find((e: any) => e?.id === id)
    : null;
  if (fromEncounters) return fromEncounters;

  const fromCases = Array.isArray(payload?.cases)
    ? payload.cases
        .flatMap((c: any) => (Array.isArray(c.encounters) ? c.encounters : [c.latestEncounter]).filter(Boolean))
        .map(normalizeEncounter)
        .find((e: any) => e?.id === id)
    : null;

  return fromCases ?? null;
}

async function fetchGatewayJson(req: NextRequest, path: string, init?: RequestInit) {
  const base = gatewayBase();
  if (!base) {
    return { ok: false, status: 503, payload: { ok: false, error: 'api_gateway_base_required' } };
  }

  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    ...init,
  });
  const payload = await readPayload(res);
  return { ok: res.ok, status: res.status, payload };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = encodeURIComponent(params.id);
  const headers = forwardHeaders(req);

  const direct = await fetchGatewayJson(req, `/api/encounters/${id}`, { method: 'GET', headers });
  if (direct.ok) {
    const encounter = unwrapEncounter(direct.payload, params.id);
    if (encounter) return json({ ok: true, encounter, source: direct.payload?.source || 'api-gateway.encounter' });
  }

  if (![404, 405, 501].includes(direct.status)) {
    return json(direct.payload ?? { ok: false, error: `encounter_upstream_${direct.status}` }, direct.status);
  }

  const list = await fetchGatewayJson(req, `/api/encounters?limit=100`, { method: 'GET', headers });
  if (!list.ok) {
    return json(list.payload ?? { ok: false, error: `encounter_list_upstream_${list.status}` }, list.status);
  }

  const encounter = unwrapEncounter(list.payload, params.id);
  if (!encounter) return json({ ok: false, error: 'encounter_not_found' }, 404);

  return json({ ok: true, encounter, source: 'patient-app.encounter.from-list' });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const bodyText = await req.text().catch(() => '{}');
  const id = encodeURIComponent(params.id);
  const headers = forwardHeaders(req, true);

  const attempts = [
    `/api/encounters/${id}/notes`,
    `/api/encounters/${id}`,
  ];

  let last: { status: number; payload: any } | null = null;
  for (const path of attempts) {
    const result = await fetchGatewayJson(req, path, {
      method: 'POST',
      headers,
      body: bodyText || '{}',
    });

    if (result.ok) return json(result.payload ?? { ok: true }, result.status);
    last = { status: result.status, payload: result.payload };
    if (![404, 405, 501].includes(result.status)) break;
  }

  return json(
    last?.payload ?? {
      ok: false,
      error: 'encounter_note_service_unavailable',
      message: 'Patient note creation is not available from the encounter service yet.',
    },
    last?.status ?? 503,
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const base = gatewayBase();
  if (!base) return json({ ok: false, error: 'api_gateway_base_required' }, 503);

  const upstream = await fetch(`${base}/api/encounters/${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
    cache: 'no-store',
    headers: forwardHeaders(req, true),
    body: await req.text().catch(() => '{}') || '{}',
  });
  const payload = await readPayload(upstream);
  return json(payload ?? { ok: upstream.ok }, upstream.status);
}
