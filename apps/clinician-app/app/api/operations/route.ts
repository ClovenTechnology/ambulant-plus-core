// apps/clinician-app/app/api/operations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { prisma } from '../../../../api-gateway/src/lib/db';
import { writeEhrIndex } from '../../../../api-gateway/src/lib/chain';
import { readIdentity } from '../../../../api-gateway/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-1';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES || 900);

function s3Client() {
  return new S3Client({ region: REGION });
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string) {
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
    const client = s3Client();
    const cmd = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    return await getSignedUrl(client, cmd, {
      expiresIn: PRESIGN_EXPIRES,
    });
  } catch (err) {
    console.warn('presign get failed', err);
    return PUBLIC_URL ? `${PUBLIC_URL.replace(/\/+$/, '')}/_files/${key}` : null;
  }
}

function getString(form: FormData, key: string, fallback = ''): string {
  const value = form.get(key);

  if (typeof value === 'string') {
    return value.trim();
  }

  return fallback;
}

function getNullableString(form: FormData, key: string): string | null {
  const value = getString(form, key);
  return value ? value : null;
}

function parseStringList(value: FormDataEntryValue | null): string[] | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    // fall through to comma splitting
  }

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');

  if (lastDot === -1) {
    return '';
  }

  return fileName.slice(lastDot);
}

export async function GET() {
  try {
    const items = await prisma.operation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      {
        ok: true,
        data: items,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('operations.get.error', err);

    const mock = [
      {
        id: 'OP-1',
        title: 'Appendicectomy',
        date: '2023-01-01',
        facility: 'Ambulant+ Surgical Centre',
        surgeon: 'Dr. Teeke',
        coClinicians: ['Dr. Naidoo'],
        clinicianCount: 2,
        recordedBy: 'Dr. Teeke',
      },
    ];

    return NextResponse.json(
      {
        ok: true,
        data: mock,
      },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const identity = readIdentity(req.headers);

  try {
    const form = await req.formData();

    const title = getString(form, 'title');
    const date = getNullableString(form, 'date');
    const facility = getNullableString(form, 'facility');
    const surgeon = getNullableString(form, 'surgeon');
    const notes = getNullableString(form, 'notes');

    const coClinicians = parseStringList(form.get('coClinicians'));

    const clinicianCountRaw = getString(form, 'clinicianCount');
    const clinicianCount =
      clinicianCountRaw && Number.isFinite(Number(clinicianCountRaw))
        ? Number(clinicianCountRaw)
        : coClinicians
          ? 1 + coClinicians.length
          : 1;

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;

    const uploadedFile = form.get('file');

    if (uploadedFile instanceof File && uploadedFile.size > 0) {
      const originalName = uploadedFile.name || 'attachment';
      const ext = fileExtension(originalName);

      const key = `operations/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext}`;

      const buffer = Buffer.from(await uploadedFile.arrayBuffer());

      await uploadToS3(
        buffer,
        key,
        uploadedFile.type || 'application/octet-stream',
      );

      fileKey = key;
      fileName = originalName;
      presignedUrl = await presignedGetUrl(key);
    }

    const created = await prisma.operation.create({
      data: {
        title,
        date: date ? new Date(date) : null,
        facility,
        surgeon,
        coClinicians: coClinicians ? { set: coClinicians } : undefined,
        clinicianCount,
        notes,
        fileKey,
        fileName,
        recordedBy: identity.uid ?? identity.role ?? 'unknown',
        source:
          identity.role === 'clinician'
            ? 'clinician'
            : identity.role === 'patient'
              ? 'patient'
              : 'unknown',
      },
    });

    if (identity.role === 'clinician') {
      try {
        const patientHash = getString(form, 'patientHash');

        const tx = await writeEhrIndex({
          recordId: created.id,
          patientHash,
          clinicianHash: identity.uid ?? '',
          contentHash: fileKey ?? '',
          uri:
            presignedUrl ??
            (fileKey ? `${PUBLIC_URL.replace(/\/+$/, '')}/_files/${fileKey}` : ''),
          kind: 'operation',
        });

        await prisma.operation.update({
          where: { id: created.id },
          data: { ehrTxId: tx.txId },
        });
      } catch (err) {
        console.warn('writeEhrIndex op failed', err);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        record: {
          ...created,
          fileUrl: presignedUrl,
          fileName,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('operations.post.error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}