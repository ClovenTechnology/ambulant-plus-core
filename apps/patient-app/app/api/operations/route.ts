// apps/patient-app/app/api/operations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-1';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES || 900);

type RequestIdentity = {
  uid: string | null;
  userId: string | null;
  orgId: string | null;
  role: string | null;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function readIdentity(headers: Headers): RequestIdentity {
  const uid =
    headers.get('x-ambulant-user-id') ||
    headers.get('x-user-id') ||
    headers.get('x-uid') ||
    null;

  return {
    uid,
    userId: uid,
    orgId: headers.get('x-ambulant-org-id') || headers.get('x-org-id') || null,
    role: headers.get('x-ambulant-role') || headers.get('x-role') || null,
  };
}

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function parseCoClinicians(value: FormDataEntryValue | null): string[] | null {
  if (!value || typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const cleaned = parsed.map((x) => String(x).trim()).filter(Boolean);
      return cleaned.length ? cleaned : null;
    }
  } catch {
    // Fall through to CSV parser.
  }

  const csv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return csv.length ? csv : null;
}

function s3Client() {
  return new S3Client({ region: REGION });
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string) {
  if (!S3_BUCKET) {
    throw new Error('s3_bucket_not_configured');
  }

  const client = s3Client();

  const upload = new Upload({
    client,
    params: {
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'private',
    },
  });

  return upload.done();
}

async function presignedGetUrl(key: string) {
  try {
    if (!S3_BUCKET) {
      return PUBLIC_URL ? `${PUBLIC_URL}/_files/${key}` : null;
    }

    const client = s3Client();

    const cmd = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    return await getSignedUrl(client, cmd, {
      expiresIn: PRESIGN_EXPIRES,
    });
  } catch (err) {
    console.warn('patient operations presign get failed', err);

    return PUBLIC_URL ? `${PUBLIC_URL}/_files/${key}` : null;
  }
}

function operationDelegate() {
  return (prisma as any).operation ?? null;
}

export async function GET() {
  try {
    const operation = operationDelegate();

    if (!operation?.findMany) {
      return json(
        {
          ok: false,
          data: [],
          error: 'operation_store_unavailable',
        },
        503,
      );
    }

    const items = await operation.findMany({
      where: { source: 'patient' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return json({ ok: true, data: items });
  } catch (err: any) {
    console.error('patient.operations.get.error', err);

    return json(
      {
        ok: false,
        data: [],
        error: err?.message || 'failed_to_load_patient_operations',
      },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  const identity = readIdentity(req.headers);

  try {
    const operation = operationDelegate();

    if (!operation?.create) {
      return json(
        {
          ok: false,
          error: 'operation_store_unavailable',
        },
        503,
      );
    }

    const fd = await req.formData();

    const title = cleanStr(fd.get('title'));

    if (!title) {
      return json({ ok: false, error: 'operation_title_required' }, 400);
    }

    const dateRaw = cleanStr(fd.get('date'));
    const facility = cleanStr(fd.get('facility')) || null;
    const surgeon = cleanStr(fd.get('surgeon')) || null;
    const notes = cleanStr(fd.get('notes')) || null;

    const coClinicians = parseCoClinicians(fd.get('coClinicians'));

    const clinicianCountRaw = cleanStr(fd.get('clinicianCount'));
    const parsedClinicianCount = clinicianCountRaw
      ? Number(clinicianCountRaw)
      : NaN;

    const clinicianCount = Number.isFinite(parsedClinicianCount)
      ? parsedClinicianCount
      : coClinicians
        ? 1 + coClinicians.length
        : 1;

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;

    const uploaded = fd.get('file');

    if (uploaded instanceof File && uploaded.size > 0) {
      const originalName = uploaded.name || 'attachment';
      const ext = path.extname(originalName) || '';

      const key = `patient/operations/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext}`;

      const arrayBuffer = await uploaded.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await uploadToS3(
        buffer,
        key,
        uploaded.type || 'application/octet-stream',
      );

      fileKey = key;
      fileName = originalName;
      presignedUrl = await presignedGetUrl(key);
    }

    const data: Record<string, any> = {
      title,
      date: dateRaw ? new Date(dateRaw) : null,
      facility,
      surgeon,
      clinicianCount,
      notes,
      fileKey,
      fileName,
      recordedBy: identity.uid ?? 'patient',
      source: 'patient',
    };

    if (coClinicians) {
      data.coClinicians = { set: coClinicians };
    }

    const created = await operation.create({ data });

    return json(
      {
        ok: true,
        record: {
          ...created,
          fileUrl: presignedUrl,
          fileName,
        },
      },
      201,
    );
  } catch (err: any) {
    console.error('patient.operations.post.error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_create_patient_operation',
      },
      500,
    );
  }
}