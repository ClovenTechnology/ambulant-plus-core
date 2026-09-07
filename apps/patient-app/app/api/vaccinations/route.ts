// apps/patient-app/app/api/vaccinations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

type GatewayPresignResponse = {
  ok?: boolean;
  uploadUrl?: string;
  key?: string;
};

type GatewayDocumentCreateResponse = {
  ok?: boolean;
  item?: {
    id: string;
    fileName?: string;
    downloadUrl?: string;
  };
};

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.APIGW_BASE_URL ||
      process.env.APIGW_ORIGIN ||
      process.env.API_GATEWAY_ORIGIN ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      CANONICAL_API_GATEWAY,
  );
}

function pickString(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean || null;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 500) };
  }
}

async function requireIdentity(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity?.uid || !identity.patientId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'patient_session_required' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }
  return { ok: true as const, identity };
}

async function uploadViaGatewayRegistry(args: {
  req: NextRequest;
  identity: NonNullable<Awaited<ReturnType<typeof readPatientGatewayIdentity>>>;
  title: string;
  notes?: string | null;
  linkedRecordId: string;
  file: File;
}) {
  const { req, identity, title, notes, linkedRecordId, file } = args;
  const base = gatewayBase();
  const authHeaders = patientGatewayHeaders({ req, identity, includeJson: true });

  const presignResponse = await fetch(new URL('/api/records/documents/presign', base), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      patientId: identity.patientId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      documentKind: 'vaccination-proof',
      encounterId: null,
    }),
    cache: 'no-store',
  });
  const presign = (await readBody(presignResponse)) as GatewayPresignResponse | null;
  if (!presignResponse.ok || !presign?.ok || !presign.uploadUrl || !presign.key) {
    throw new Error(String((presign as any)?.error || 'document_presign_failed'));
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`document_upload_failed:${uploadResponse.status}`);
  }

  const createResponse = await fetch(new URL('/api/records/documents', base), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      patientId: identity.patientId,
      encounterId: null,
      title,
      documentKind: 'vaccination-proof',
      sourceApp: 'patient-app',
      sourceType: 'upload',
      fileKey: presign.key,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: Number.isFinite(file.size) ? file.size : null,
      linkedRecordType: 'vaccination',
      linkedRecordId,
      notes: notes || null,
    }),
    cache: 'no-store',
  });
  const created = (await readBody(createResponse)) as GatewayDocumentCreateResponse | null;
  if (!createResponse.ok || !created?.ok || !created.item?.id) {
    throw new Error(String((created as any)?.error || 'document_create_failed'));
  }
  return created.item;
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireIdentity(req);
    if (!context.ok) return context.response;

    const response = await fetch(new URL('/api/patients/vaccinations', gatewayBase()), {
      method: 'GET',
      headers: patientGatewayHeaders({ req, identity: context.identity }),
      cache: 'no-store',
    });
    const body = await readBody(response);
    if (!response.ok || !body?.ok) {
      return NextResponse.json(
        { ok: false, error: body?.error || 'vaccinations_get_failed', data: [] },
        { status: response.status || 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, data: Array.isArray(body.items) ? body.items : [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const message = String(err?.message || 'vaccinations_get_failed');
    return NextResponse.json(
      { ok: false, error: message, data: [] },
      { status: message === 'internal_identity_secret_unavailable' ? 503 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireIdentity(req);
    if (!context.ok) return context.response;

    const form = await req.formData();
    const vaccine = pickString(form, 'vaccine');
    const date = pickString(form, 'date');
    const batch = pickString(form, 'batch');
    const notes = pickString(form, 'notes');
    const facility = pickString(form, 'facility');
    const clinician = pickString(form, 'clinician');
    const continuityKind = pickString(form, 'continuityKind');
    const source = continuityKind === 'booster' ? 'patient-followup' : 'patient';

    if (!vaccine) {
      return NextResponse.json({ ok: false, error: 'vaccine_required' }, { status: 400 });
    }

    const createResponse = await fetch(new URL('/api/patients/vaccinations', gatewayBase()), {
      method: 'POST',
      headers: patientGatewayHeaders({ req, identity: context.identity, includeJson: true }),
      body: JSON.stringify({ vaccine, date, batch, notes, facility, clinician, source }),
      cache: 'no-store',
    });
    const createBody = await readBody(createResponse);
    if (!createResponse.ok || !createBody?.ok || !createBody?.item?.id) {
      return NextResponse.json(
        { ok: false, error: createBody?.error || 'vaccination_create_failed' },
        { status: createResponse.status || 502 },
      );
    }

    const created = createBody.item;
    const maybeFile = form.get('file');
    let document: GatewayDocumentCreateResponse['item'] | null = null;
    if (maybeFile instanceof File && maybeFile.size > 0) {
      document = await uploadViaGatewayRegistry({
        req,
        identity: context.identity,
        title: `Vaccination Proof • ${vaccine}`,
        notes,
        linkedRecordId: String(created.id),
        file: maybeFile,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        record: {
          ...created,
          patientId: context.identity.patientId,
          documentId: document?.id || null,
          fileName: document?.fileName || created?.fileName || null,
          fileUrl: document?.downloadUrl || null,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const message = String(err?.message || 'vaccinations_post_failed');
    return NextResponse.json(
      { ok: false, error: message },
      { status: message === 'internal_identity_secret_unavailable' ? 503 : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, error: 'vaccination_patch_not_supported_use_followup_record' },
    { status: 405, headers: { 'Cache-Control': 'no-store' } },
  );
}
