// apps/clinician-app/app/api/encounters/[id]/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Coding = {
  system: string;
  code: string;
  display: string;
};

type AnyRecord = Record<string, any>;

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const FORWARD_HEADER_ALLOWLIST = [
  'authorization',
  'cookie',
  'x-ambulant-identity',
  'x-ambulant-user-id',
  'x-ambulant-role',
  'x-ambulant-org-id',
  'x-ambulant-workspace',
  'x-ambulant-trusted',
  'x-user-id',
  'x-uid',
  'x-role',
  'x-org-id',
  'x-actor-ref-id',
  'x-clinician-id',
  'x-patient-id',
  'x-current-patient-id',
];

function gatewayBase() {
  const base =
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    CANONICAL_API_GATEWAY;

  return base.replace(/\/+$/, '');
}

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalString(value: unknown, max = 4000) {
  const valueClean = clean(value, max);
  return valueClean ? valueClean : undefined;
}

function forwardHeaders(req: NextRequest, trustedIdentity: string) {
  const headers = new Headers();
  const authorization = req.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  headers.set('x-ambulant-identity', trustedIdentity);
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  const requestId = req.headers.get('x-request-id');
  const correlationId = req.headers.get('x-correlation-id');
  if (requestId) headers.set('x-request-id', requestId);
  if (correlationId) headers.set('x-correlation-id', correlationId);
  return headers;
}

function responseHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set('cache-control', 'no-store');
  return headers;
}

async function relayGatewayResponse(upstream: Response) {
  const headers = responseHeaders(upstream);
  const contentType = upstream.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, {
      status: upstream.status,
      headers,
    });
  }

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers,
  });
}

function textCoding(value: unknown): Coding[] {
  const display = optionalString(value, 500);
  if (!display) return [];

  return [
    {
      system: 'text',
      code: display,
      display,
    },
  ];
}

function normalizeMedication(raw: AnyRecord) {
  const coding = Array.isArray(raw?.coding)
    ? raw.coding
    : Array.isArray(raw?.codings)
      ? raw.codings
      : raw?.rxcui
        ? [
            {
              system: 'rxnorm',
              code: clean(raw.rxcui, 120),
              display: optionalString(raw.drug || raw.name || raw.display, 500) || clean(raw.rxcui, 120),
            },
          ]
        : textCoding(raw?.drug || raw?.name || raw?.display);

  const quantityText = optionalString(raw?.quantity?.text, 200) || optionalString(raw?.qty, 200);

  return {
    coding,
    formText: optionalString(raw?.formText || raw?.form, 120),
    doseText: optionalString(raw?.doseText || raw?.dose, 200),
    routeText: optionalString(raw?.routeText || raw?.route, 120),
    frequencyText: optionalString(raw?.frequencyText || raw?.freq || raw?.frequency, 200),
    durationText: optionalString(raw?.durationText || raw?.duration, 200),
    quantity: raw?.quantity && typeof raw.quantity === 'object'
      ? raw.quantity
      : quantityText
        ? { text: quantityText }
        : undefined,
    repeats: typeof raw?.repeats === 'number'
      ? raw.repeats
      : typeof raw?.refills === 'number'
        ? raw.refills
        : 0,
    note: optionalString(raw?.note || raw?.notes, 2000),
  };
}

function normalizeLab(raw: AnyRecord) {
  const icdRaw = raw?.icd10 || raw?.icd;

  const icd10 =
    icdRaw && typeof icdRaw === 'object'
      ? icdRaw
      : optionalString(icdRaw, 120)
        ? {
            system: 'icd-10',
            code: clean(icdRaw, 120),
            display: clean(icdRaw, 120),
          }
        : undefined;

  return {
    testText: optionalString(raw?.testText || raw?.test || raw?.name, 500) || 'Lab order',
    priority: optionalString(raw?.priority, 40) || 'Routine',
    specimenText: optionalString(raw?.specimenText || raw?.specimen, 200),
    icd10,
    note: optionalString(raw?.note || raw?.instructions, 2000),
  };
}

function normalizePayload(body: AnyRecord, encounterId: string) {
  const medications = Array.isArray(body?.medications)
    ? body.medications.map(normalizeMedication)
    : [];

  const labs = Array.isArray(body?.labs)
    ? body.labs.map(normalizeLab)
    : [];

  return {
    ...body,
    encounterId,
    patient: body?.patient && typeof body.patient === 'object'
      ? body.patient
      : {
          id: optionalString(body?.patientId, 120),
          name: optionalString(body?.patientName, 240),
        },
    clinician: body?.clinician && typeof body.clinician === 'object'
      ? body.clinician
      : {
          id: optionalString(body?.clinicianId, 120),
          name: optionalString(body?.clinicianName, 240),
        },
    medications,
    labs,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encounterId = clean(params.id, 120);

  const auth = await requireClinicianAuth(req, { allowAdmin: false, allowAdminStaff: false });
  if (!auth.ok) return authErrorResponse(auth);
  if (auth.role !== 'clinician') {
    return NextResponse.json({ ok: false, error: 'clinician_required' }, { status: 403 });
  }

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || 'identity_bridge_failed') },
      { status: Number(error?.status || 500), headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!encounterId) {
    return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as AnyRecord | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json_body' }, { status: 400 });
  }

  const payload = normalizePayload(body, encounterId);

  if (payload.medications.length === 0 && payload.labs.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'at_least_one_medication_or_lab_required' },
      { status: 400 },
    );
  }

  const upstreamUrl = `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/erx`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardHeaders(req, trustedIdentity),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    return relayGatewayResponse(upstream);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encounterId = clean(params.id, 120);

  const auth = await requireClinicianAuth(req, { allowAdmin: false, allowAdminStaff: false });
  if (!auth.ok) return authErrorResponse(auth);
  if (auth.role !== 'clinician') {
    return NextResponse.json({ ok: false, error: 'clinician_required' }, { status: 403 });
  }

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || 'identity_bridge_failed') },
      { status: Number(error?.status || 500), headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!encounterId) {
    return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });
  }

  const upstreamUrl = `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/erx`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: forwardHeaders(req, trustedIdentity),
      cache: 'no-store',
    });

    return relayGatewayResponse(upstream);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
