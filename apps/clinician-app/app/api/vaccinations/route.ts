// apps/clinician-app/app/api/vaccinations/route.ts
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

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');

  if (lastDot === -1) {
    return '';
  }

  return fileName.slice(lastDot);
}

export async function GET() {
  try {
    const items = await prisma.vaccination.findMany({
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
    console.error('vaccinations.get.error', err);

    const mock = [
      {
        id: 'VAX-1',
        vaccine: 'COVID-19 (Pfizer)',
        date: '2022-11-01',
        batch: 'PF12345',
        clinician: 'Dr. Adeola',
        facility: 'Lagos General',
        recordedBy: 'Dr. Adeola',
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

    const vaccine = getString(form, 'vaccine');
    const date = getNullableString(form, 'date');
    const batch = getNullableString(form, 'batch');
    const notes = getNullableString(form, 'notes');
    const clinician = getNullableString(form, 'clinician');
    const facility = getNullableString(form, 'facility');

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;

    const uploadedFile = form.get('file');

    if (uploadedFile instanceof File && uploadedFile.size > 0) {
      const originalName = uploadedFile.name || 'attachment';
      const ext = fileExtension(originalName);

      const key = `vaccinations/${Date.now()}-${Math.random()
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

    const created = await prisma.vaccination.create({
      data: {
        vaccine,
        date: date ? new Date(date) : null,
        batch,
        notes,
        clinician,
        facility,
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
          kind: 'vaccination',
        });

        await prisma.vaccination.update({
          where: { id: created.id },
          data: { ehrTxId: tx.txId },
        });
      } catch (err) {
        console.warn('writeEhrIndex vax failed', err);
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
    console.error('vaccinations.post.error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}