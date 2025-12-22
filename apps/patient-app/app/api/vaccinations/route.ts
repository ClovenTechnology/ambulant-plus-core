// apps/patient-app/app/api/vaccinations/route.ts
import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { prisma } from '/../../api-gateway/src/lib/db';
import { readIdentity } from '/../../api-gateway/src/lib/identity';

export const config = { api: { bodyParser: false } };
const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-1';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const PRESIGN_EXPIRES = Number(process.env.PRESIGN_EXPIRES || 900);

function s3Client() { return new S3Client({ region: REGION }); }
async function uploadToS3(buffer: Buffer, key: string, contentType: string) {
  const client = s3Client();
  const upload = new Upload({ client, params: { Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, ACL: 'private' } });
  return upload.done();
}
async function presignedGetUrl(key: string) {
  try { const client = s3Client(); const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }); return await getSignedUrl(client, cmd, { expiresIn: PRESIGN_EXPIRES }); }
  catch (err) { console.warn('presign get failed', err); return PUBLIC_URL ? `${PUBLIC_URL}/_files/${key}` : null; }
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
    const items = await prisma.vaccination.findMany({ where: { source: 'patient' }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ ok: true, data: items }, { status: 200 });
  } catch (err) {
    console.error('patient.vaccinations.get.error', err);
    const mock = [{ id: 'VAX-1', vaccine: 'COVID-19 (Pfizer)', date: '2022-11-01', batch: 'PF12345', notes: '2 doses' }];
    return NextResponse.json({ ok: true, data: mock }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const identity = readIdentity(req.headers);
  try {
    const { fields, files } = await parseForm(req);
    const vaccine = String(fields.vaccine ?? '').trim();
    const date = fields.date ? String(fields.date) : null;
    const batch = fields.batch ? String(fields.batch) : null;
    const notes = fields.notes ? String(fields.notes) : null;
    const facility = fields.facility ? String(fields.facility) : null;

    let fileKey: string | null = null;
    let fileName: string | null = null;
    let presignedUrl: string | null = null;
    if (files && files.file) {
      const f = Array.isArray(files.file) ? files.file[0] : files.file;
      const filepath = (f as any).filepath || (f as any).path;
      const buffer = fs.readFileSync(filepath);
      const originalName = (f as any).originalFilename || 'attachment';
      const ext = path.extname(originalName) || '';
      const key = `patient/vaccinations/${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      await uploadToS3(buffer, key, (f as any).mimetype || 'application/octet-stream');
      try { fs.unlinkSync(filepath); } catch (_e) {}
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
        facility,
        fileKey,
        fileName,
        recordedBy: identity.uid ?? 'patient',
        source: 'patient',
      },
    });

    const out = { ...created, fileUrl: presignedUrl, fileName };
    return NextResponse.json({ ok: true, record: out }, { status: 201 });
  } catch (err) {
    console.error('patient.vaccinations.post.error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
