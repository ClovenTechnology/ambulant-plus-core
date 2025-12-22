// apps/patient-app/app/api/conditions/route.ts
import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Keep your existing imports if they are valid in your monorepo.
// If you use tsconfig path aliases, prefer those instead of "/../../"
import { prisma } from '/../../api-gateway/src/lib/db';
import { readIdentity } from '/../../api-gateway/src/lib/identity';

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
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'private',
    }),
  );
  return { key };
}

async function presignedGetUrl(key: string) {
  try {
    const client = s3Client();
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    return await getSignedUrl(client, cmd, { expiresIn: PRESIGN_EXPIRES });
  } catch (err) {
    console.warn('presign get failed', err);
    return PUBLIC_URL ? `${PUBLIC_URL}/_files/${key}` : null;
  }
}

export async function GET() {
  try {
    const items = await prisma.condition.findMany({
      where: { source: 'patient' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ ok: true, data: items }, { status: 200 });
  } catch (err) {
    console.error('patient.conditions.get.error', err);
    const mock = [
      {
        id: 'C-1',
        name: 'Hypertension',
        diagnosedAt: '2020-01-01',
        status: 'Active',
        notes: 'Controlled with med',
      },
    ];
    return NextResponse.json({ ok: true, data: mock }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const identity = readIdentity((req as any).headers);

  try {
    const form = await req.formData();

    const name = String(form.get('name') ?? '').trim();
    const diagnosedAtVal = form.get('diagnosedAt');
    const diagnosedAt = diagnosedAtVal ? String(diagnosedAtVal) : null;
    const status = String(form.get('status') ?? 'Active');
    const notesVal = form.get('notes');
    const facilityVal = form.get('facility');

    const notes = notesVal != null ? String(notesVal) : null;
    const facility = facilityVal != null ? String(facilityVal) : null;

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;

    const file = form.get('file') as File | null;
    if (file && typeof file.arrayBuffer === 'function') {
      const ab = await file.arrayBuffer();
      const buffer = Buffer.from(ab);
      const originalName = file.name || 'attachment';
      const extMatch = originalName.match(/\.[A-Za-z0-9]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const key = `patient/conditions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

      await uploadToS3(buffer, key, (file as any).type || 'application/octet-stream');

      fileKey = key;
      fileName = originalName;
      presignedUrl = await presignedGetUrl(key);
    }

    const created = await prisma.condition.create({
      data: {
        name,
        diagnosedAt: diagnosedAt ? new Date(diagnosedAt) : null,
        status,
        notes,
        facility,
        fileKey,
        fileName,
        recordedBy: (identity as any)?.uid ?? 'patient',
        source: 'patient',
      },
    });

    const out = { ...created, fileUrl: presignedUrl, fileName };
    return NextResponse.json({ ok: true, record: out }, { status: 201 });
  } catch (err) {
    console.error('patient.conditions.post.error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
