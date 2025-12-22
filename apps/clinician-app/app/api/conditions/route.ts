// apps/clinician-app/app/api/conditions/route.ts
import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { prisma } from '/../../api-gateway/src/lib/db';
import { writeEhrIndex } from '/../../api-gateway/src/lib/chain';
import { readIdentity } from '/../../api-gateway/src/lib/identity';

export const config = { api: { bodyParser: false } };

const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-1';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES || 900);

function s3Client() { return new S3Client({ region: REGION }); }
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
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(client, cmd, { expiresIn: PRESIGN_EXPIRES });
    return url;
  } catch (err) {
    console.warn('presign get failed', err);
    return PUBLIC_URL ? `${PUBLIC_URL}/_files/${key}` : null;
  }
}

async function parseForm(req: Request) {
  const form = formidable({ multiples: false });
  return await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse((req as any) as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export async function GET() {
  try {
    const items = await prisma.condition.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ ok: true, data: items }, { status: 200 });
  } catch (err) {
    console.error('conditions.get.error', err);
    const mock = [
      { id: 'C-1', name: 'Hypertension', diagnosedAt: '2020-01-01', status: 'Active', facility: 'Ambulant+ Clinic', clinician: 'Dr. Naidoo', recordedBy: 'Dr. Naidoo', source: 'clinician' },
    ];
    return NextResponse.json({ ok: true, data: mock }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const identity = readIdentity(req.headers);
  try {
    const { fields, files } = await parseForm(req);

    const name = String(fields.name ?? '').trim();
    const diagnosedAt = (fields.diagnosedAt ? String(fields.diagnosedAt) : null);
    const status = String(fields.status ?? 'Active');
    const notes = fields.notes ? String(fields.notes) : null;
    const facility = fields.facility ? String(fields.facility) : null;
    const clinician = fields.clinician ? String(fields.clinician) : null;
    const onAmbulant = fields.onAmbulant === 'true' || fields.onAmbulant === 'on' || fields.onAmbulant === true;

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;

    if (files && files.file) {
      const f = Array.isArray(files.file) ? files.file[0] : files.file;
      const filepath = (f as any).filepath || (f as any).path;
      const buffer = fs.readFileSync(filepath);
      const originalName = (f as any).originalFilename || 'attachment';
      const ext = path.extname(originalName) || '';
      const key = `conditions/${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;

      await uploadToS3(buffer, key, (f as any).mimetype || 'application/octet-stream');
      try { fs.unlinkSync(filepath); } catch (_e) {}

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
        clinician,
        onAmbulant: Boolean(onAmbulant),
        fileKey,
        fileName,
        recordedBy: identity.uid ?? (identity.role ?? 'unknown'),
        source: identity.role === 'clinician' ? 'clinician' : identity.role === 'patient' ? 'patient' : 'unknown',
      },
    });

    if (identity.role === 'clinician') {
      try {
        const tx = await writeEhrIndex({
          recordId: created.id,
          patientHash: (fields.patientHash ? String(fields.patientHash) : ''),
          clinicianHash: identity.uid ?? '',
          contentHash: (fileKey ?? '') || '',
          uri: presignedUrl ?? (fileKey ? `${PUBLIC_URL}/_files/${fileKey}` : ''),
          kind: 'condition',
        });
        await prisma.condition.update({ where: { id: created.id }, data: { ehrTxId: tx.txId } });
      } catch (e) {
        console.warn('writeEhrIndex failed', e);
      }
    }

    const out = { ...created, fileUrl: presignedUrl, fileName };
    return NextResponse.json({ ok: true, record: out }, { status: 201 });
  } catch (err) {
    console.error('conditions.post.error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
