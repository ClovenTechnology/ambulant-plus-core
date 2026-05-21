// apps/patient-app/app/api/encounters/route.ts
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

function statusText(status: number) {
  if (status === 401) return 'Encounter access requires a signed-in patient session.';
  if (status === 403) return 'You do not have access to this encounter scope.';
  if (status === 404) return 'No encounters were found for this account.';
  return 'Encounter service is temporarily unavailable.';
}

function normalizeEncounter(row: any) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || row.encounterId || '').trim();
  if (!id) return null;

  const clinician = row.clinician && typeof row.clinician === 'object'
    ? row.clinician
    : row.clinicianId
      ? { id: row.clinicianId, name: row.clinicianName || 'Clinician' }
      : null;

  const primaryTime =
    row.primaryTime ||
    row.endedAt ||
    row.stop ||
    row.consultationEndedAt ||
    row.startedAt ||
    row.start ||
    row.consultationStartedAt ||
    row.updatedAt ||
    row.createdAt ||
    null;

  return {
    ...row,
    id,
    caseId: row.caseId || row.case_id || row.patientCaseId || `encounter-${id}`,
    status: row.status || 'open',
    visitMode: row.visitMode || row.mode || row.type || row.appointment?.visitMode || null,
    clinician,
    primaryTime,
    start: row.start || row.startedAt || row.consultationStartedAt || row.createdAt || null,
    stop: row.stop || row.endedAt || row.consultationEndedAt || null,
    startedAt: row.startedAt || row.start || row.consultationStartedAt || null,
    endedAt: row.endedAt || row.stop || row.consultationEndedAt || null,
    counts: row.counts || {},
    documents: Array.isArray(row.documents) ? row.documents : [],
  };
}

function encounterTitle(row: any) {
  const summary = row?.summaryPayload && typeof row.summaryPayload === 'object' ? row.summaryPayload : null;
  return (
    row?.caseTitle ||
    row?.title ||
    summary?.reason ||
    summary?.diagnosisText ||
    summary?.chiefComplaint ||
    'Clinical encounter'
  );
}

function groupIntoCases(encounters: any[]) {
  const map = new Map<string, any>();

  for (const original of encounters) {
    const e = normalizeEncounter(original);
    if (!e) continue;
    const key = String(e.caseId || `encounter-${e.id}`);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        id: key,
        title: encounterTitle(e),
        status: e.caseStatus || e.status || 'open',
        updatedAt: e.primaryTime,
        encountersCount: 1,
        latestEncounter: e,
        encounters: [e],
      });
      continue;
    }

    existing.encounters.push(e);
    existing.encountersCount = existing.encounters.length;
    const current = Date.parse(String(e.primaryTime || '')) || 0;
    const previous = Date.parse(String(existing.updatedAt || '')) || 0;
    if (current >= previous) {
      existing.latestEncounter = e;
      existing.updatedAt = e.primaryTime;
      existing.status = e.caseStatus || e.status || existing.status;
      existing.title = existing.title || encounterTitle(e);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (Date.parse(String(b.updatedAt || '')) || 0) - (Date.parse(String(a.updatedAt || '')) || 0),
  );
}

function normalizeListPayload(payload: any) {
  const rawCases = Array.isArray(payload?.cases) ? payload.cases : [];
  const rawEncounters = Array.isArray(payload?.encounters)
    ? payload.encounters
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

  const encounters = rawEncounters.map(normalizeEncounter).filter(Boolean);
  const cases = rawCases.length ? rawCases : groupIntoCases(encounters);

  return {
    ok: payload?.ok !== false,
    source: payload?.source || 'patient-app.encounters.proxy',
    count: encounters.length,
    cases,
    encounters,
    summary: {
      totalCases: cases.length,
      totalEncounters: encounters.length,
      openCases: cases.filter((c: any) => /open|active|progress|scheduled/i.test(String(c.status || c.latestEncounter?.status || ''))).length,
      completedEncounters: encounters.filter((e: any) => /complete|closed|done|ended/i.test(String(e.status || ''))).length,
      documents: encounters.reduce((sum: number, e: any) => sum + Number(e.counts?.documents || e.documents?.length || 0), 0),
      erxOrders: encounters.reduce((sum: number, e: any) => sum + Number(e.counts?.erxOrders || 0), 0),
      labOrders: encounters.reduce((sum: number, e: any) => sum + Number(e.counts?.labOrders || 0), 0),
    },
  };
}

async function forward(req: NextRequest, method: 'GET' | 'POST') {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Encounter service is unavailable because the API gateway base URL is not configured.',
        cases: [],
        encounters: [],
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const path = `/api/encounters${incoming.search || ''}`;
  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: forwardHeaders(req, method !== 'GET'),
  };

  if (method !== 'GET') {
    init.body = await req.text().catch(() => '{}') || '{}';
  }

  const upstream = await fetch(`${base}${path}`, init);
  const payload = await readPayload(upstream);

  if (!upstream.ok) {
    return json(
      {
        ok: false,
        error: payload?.error || `encounters_upstream_${upstream.status}`,
        message: payload?.message || statusText(upstream.status),
        cases: [],
        encounters: [],
      },
      upstream.status,
    );
  }

  return json(normalizeListPayload(payload), upstream.status);
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function POST(req: NextRequest) {
  return forward(req, 'POST');
}
