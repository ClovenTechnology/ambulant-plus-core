// apps/clinician-app/app/api/encounters/[id]/docs/route.ts
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';
const MAX_ENCOUNTER_EVIDENCE_BYTES = 32 * 1024 * 1024;

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function gatewayBase() {
  const raw =
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    CANONICAL_API_GATEWAY;

  return clean(raw, 1000).replace(/\/+$/, '');
}

function evidenceBucket() {
  return clean(
    process.env.S3_EVIDENCE_BUCKET ||
      process.env.S3_BUCKET ||
      process.env.S3_BUCKET_NAME,
    500,
  );
}

function s3Client() {
  const accessKeyId = clean(process.env.AWS_ACCESS_KEY_ID, 500);
  const secretAccessKey = clean(process.env.AWS_SECRET_ACCESS_KEY, 1000);

  return new S3Client({
    region: clean(process.env.AWS_REGION, 120) || 'af-south-1',
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
  });
}

function safePathToken(value: string, fallback: string) {
  return (
    clean(value, 240)
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 180) || fallback
  );
}

async function deleteUploadedObject(bucket: string, key: string) {
  try {
    await s3Client().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (error) {
    console.warn('[encounters/docs] failed to remove orphaned S3 object', {
      key,
      error,
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: false,
    allowAdminStaff: false,
  });

  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  if (auth.role !== 'clinician') {
    return NextResponse.json(
      { ok: false, error: 'clinician_required' },
      { status: 403 },
    );
  }

  const encounterId = clean(params.id, 120);

  if (!encounterId) {
    return NextResponse.json(
      { ok: false, error: 'encounter_id_required' },
      { status: 400 },
    );
  }

  let trustedIdentity: string;

  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: clean(error?.message, 240) || 'identity_bridge_failed',
      },
      {
        status: Number(error?.status || 500),
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  let form: FormData;

  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'multipart_form_required' },
      { status: 400 },
    );
  }

  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'file_required' },
      { status: 400 },
    );
  }

  if (!file.size || file.size > MAX_ENCOUNTER_EVIDENCE_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: file.size ? 'file_too_large' : 'empty_file',
        maxBytes: MAX_ENCOUNTER_EVIDENCE_BYTES,
      },
      { status: file.size ? 413 : 400 },
    );
  }

  const patientId = clean(form.get('patientId'), 120);

  if (!patientId) {
    return NextResponse.json(
      { ok: false, error: 'patient_id_required' },
      { status: 400 },
    );
  }

  const docType = clean(form.get('docType'), 80) || 'device-evidence';
  const source = clean(form.get('source'), 120) || 'clinician-device-capture';
  const title =
    clean(form.get('title'), 240) ||
    clean(file.name, 240) ||
    'Encounter clinical evidence';
  const contentType =
    clean(file.type, 120) || 'application/octet-stream';

  const bucket = evidenceBucket();

  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: 'evidence_storage_not_configured' },
      { status: 503 },
    );
  }

  const safeEncounter = safePathToken(encounterId, 'encounter');
  const safePatient = safePathToken(patientId, 'patient');
  const safeName = safePathToken(file.name, 'capture.bin');

  const fileKey = [
    'clinical-evidence',
    safePatient,
    safeEncounter,
    `${Date.now()}_${randomUUID()}_${safeName}`,
  ].join('/');

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: bytes,
        ContentType: contentType,
        Metadata: {
          encounterid: safeEncounter,
          patientid: safePatient,
          source: safePathToken(source, 'clinician-device-capture'),
        },
      }),
    );
  } catch (error: any) {
    console.error('[encounters/docs] S3 upload failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'encounter_evidence_upload_failed',
        message: clean(error?.message, 300),
      },
      { status: 502 },
    );
  }

  const gateway = gatewayBase();

  try {
    const upstream = await fetch(
      `${gateway}/api/encounters/${encodeURIComponent(encounterId)}/docs`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-ambulant-identity': trustedIdentity,
        },
        body: JSON.stringify({
          patientId,
          docType,
          title,
          fileName: file.name,
          contentType,
          size: file.size,
          fileKey,
          source,
        }),
        cache: 'no-store',
      },
    );

    const text = await upstream.text();
    const body = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { ok: false, error: text.slice(0, 500) };
          }
        })()
      : {};

    if (!upstream.ok || body?.ok === false) {
      await deleteUploadedObject(bucket, fileKey);

      return NextResponse.json(
        {
          ok: false,
          error:
            clean(body?.error, 240) ||
            clean(body?.message, 240) ||
            'encounter_document_registration_failed',
        },
        { status: upstream.status || 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        item: body?.item ?? body,
        storage: {
          provider: 's3',
          key: fileKey,
          bytes: file.size,
          contentType,
        },
      },
      {
        status: 201,
        headers: { 'cache-control': 'no-store' },
      },
    );
  } catch (error: any) {
    await deleteUploadedObject(bucket, fileKey);

    console.error('[encounters/docs] gateway registration failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'encounter_document_registration_failed',
        message: clean(error?.message, 300),
      },
      { status: 502 },
    );
  }
}
