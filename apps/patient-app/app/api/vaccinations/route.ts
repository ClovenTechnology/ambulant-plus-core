// apps/patient-app/app/api/vaccinations/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProfileResponse = {
  ok?: boolean;
  patientId?: string | null;
  userId?: string | null;
  name?: string | null;
  patientRaw?: any;
};

type GatewayPresignResponse = {
  ok?: boolean;
  uploadUrl?: string;
  key?: string;
  expiresIn?: number;
  patientId?: string;
  encounterId?: string | null;
  documentKind?: string;
  mode?: string;
  relationshipId?: string | null;
};

type GatewayDocumentCreateResponse = {
  ok?: boolean;
  item?: {
    id: string;
    patientId: string;
    encounterId?: string | null;
    title: string;
    documentKind: string;
    sourceApp?: string;
    sourceType?: string;
    fileKey: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    status?: string;
    linkedRecordType?: string;
    linkedRecordId?: string;
    notes?: string;
    createdByUserId?: string;
    createdByRole?: string;
    relationshipId?: string;
    createdAt: string;
    updatedAt: string;
    downloadUrl?: string;
  };
};

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function appBase(req: NextRequest) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    req.nextUrl.origin;
  return trimSlash(base);
}

function apigwBaseSoft() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.APIGW_ORIGIN ||
      process.env.API_GATEWAY_ORIGIN ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-user-id',
    'x-current-patient-id',
    'x-patient-id',
    'user-agent',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set('accept', 'application/json');
  if (!headers.get('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

async function readSelfProfile(req: NextRequest): Promise<ProfileResponse | null> {
  const url = new URL('/api/profile', appBase(req));
  return fetchJson<ProfileResponse>(url.toString(), {
    headers: forwardHeaders(req),
  });
}

async function resolvePatientId(req: NextRequest): Promise<string> {
  const profile = await readSelfProfile(req);
  return String(profile?.patientId || '').trim();
}

function pickString(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

async function uploadViaGatewayRegistry(args: {
  req: NextRequest;
  patientId: string;
  title: string;
  notes?: string | null;
  linkedRecordType: string;
  linkedRecordId: string;
  file: File;
}) {
  const { req, patientId, title, notes, linkedRecordType, linkedRecordId, file } = args;

  const gatewayBase = apigwBaseSoft();
  if (!gatewayBase) {
    throw new Error('apigw_base_missing');
  }

  const presignUrl = new URL('/api/records/documents/presign', gatewayBase);
  const presign = await fetchJson<GatewayPresignResponse>(presignUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(forwardHeaders(req).entries()),
    },
    body: JSON.stringify({
      patientId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      documentKind: 'vaccination-proof',
      encounterId: null,
    }),
  });

  if (!presign?.ok || !presign.uploadUrl || !presign.key) {
    throw new Error('document_presign_failed');
  }

  const uploadRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`document_upload_failed:${uploadRes.status}`);
  }

  const createUrl = new URL('/api/records/documents', gatewayBase);
  const created = await fetchJson<GatewayDocumentCreateResponse>(createUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(forwardHeaders(req).entries()),
    },
    body: JSON.stringify({
      patientId,
      encounterId: null,
      title,
      documentKind: 'vaccination-proof',
      sourceApp: 'patient-app',
      sourceType: 'upload',
      fileKey: presign.key,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: Number.isFinite(file.size) ? file.size : null,
      linkedRecordType,
      linkedRecordId,
      notes: notes || null,
    }),
  });

  if (!created?.ok || !created.item?.id) {
    throw new Error('document_create_failed');
  }

  return created.item;
}

export async function GET(req: NextRequest) {
  try {
    const patientId = await resolvePatientId(req);

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: 'patient_id_required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const url = new URL('/api/history/vaccinations', appBase(req));
    url.searchParams.set('patientId', patientId);
    url.searchParams.set('limit', '100');

    const json = await fetchJson<any>(url.toString(), {
      headers: forwardHeaders(req),
    });

    const items = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.data)
        ? json.data
        : [];

    return NextResponse.json(
      { ok: true, data: items },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || 'vaccinations_get_failed'),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const patientId = await resolvePatientId(req);

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: 'patient_id_required' },
        { status: 400 },
      );
    }

    const form = await req.formData();

    const vaccine = pickString(form, 'vaccine');
    const date = pickString(form, 'date');
    const batch = pickString(form, 'batch');
    const notes = pickString(form, 'notes');
    const facility = pickString(form, 'facility');
    const clinician = pickString(form, 'clinician');

    if (!vaccine) {
      return NextResponse.json(
        { ok: false, error: 'vaccine_required' },
        { status: 400 },
      );
    }

    const createUrl = new URL('/api/history/vaccinations', appBase(req));
    const createRes = await fetch(createUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...Object.fromEntries(forwardHeaders(req).entries()),
      },
      body: JSON.stringify({
        patientId,
        vaccine,
        date,
        batch,
        notes,
        facility,
        clinician,
        source: 'patient',
      }),
      cache: 'no-store',
    });

    const createJson = await createRes.json().catch(() => null);

    if (!createRes.ok || !createJson) {
      return NextResponse.json(
        {
          ok: false,
          error:
            createJson?.error ||
            createJson?.message ||
            'vaccination_create_failed',
        },
        { status: createRes.status || 500 },
      );
    }

    const created =
      createJson?.item ||
      createJson?.record ||
      createJson?.data ||
      createJson;

    const createdId = String(created?.id || '').trim();
    if (!createdId) {
      return NextResponse.json(
        { ok: false, error: 'vaccination_create_missing_id' },
        { status: 500 },
      );
    }

    const maybeFile = form.get('file');
    let document: GatewayDocumentCreateResponse['item'] | null = null;

    if (maybeFile instanceof File && maybeFile.size > 0) {
      document = await uploadViaGatewayRegistry({
        req,
        patientId,
        title: `Vaccination Proof • ${vaccine}`,
        notes,
        linkedRecordType: 'vaccination',
        linkedRecordId: createdId,
        file: maybeFile,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        record: {
          ...created,
          patientId,
          documentId: document?.id || null,
          fileName: document?.fileName || null,
          fileUrl: document?.downloadUrl || null,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || 'vaccinations_post_failed'),
      },
      { status: 500 },
    );
  }
}