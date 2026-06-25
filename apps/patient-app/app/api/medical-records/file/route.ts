import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function bucketName() {
  return process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || '';
}

function s3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function readPatientSession(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');

  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) return null;

  const patientId = clean(
    payload.patientId ||
      payload.actorRefId ||
      payload.profile?.patientId ||
      payload.profile?.id ||
      payload.user?.patientId ||
      payload.user?.actorRefId,
    180,
  );

  return patientId ? { patientId } : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await readPatientSession(req);
    if (!session) return json({ ok: false, error: 'patient_session_required' }, 401);

    const url = new URL(req.url);
    const documentId = clean(url.searchParams.get('documentId'), 180);
    if (!documentId) return json({ ok: false, error: 'documentId_required' }, 400);

    const doc = await prisma.patientDocument.findFirst({
      where: {
        id: documentId,
        patientId: session.patientId,
      },
      select: {
        id: true,
        fileKey: true,
        fileName: true,
        mimeType: true,
      },
    });

    if (!doc) return json({ ok: false, error: 'document_not_found' }, 404);

    const bucket = bucketName();
    if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return json({ ok: false, error: 'storage_not_configured' }, 503);
    }

    const signedUrl = await getSignedUrl(
      s3Client(),
      new GetObjectCommand({
        Bucket: bucket,
        Key: doc.fileKey,
        ResponseContentType: doc.mimeType || undefined,
        ResponseContentDisposition: `attachment; filename="${(doc.fileName || 'document').replace(/"/g, '')}"`,
      }),
      { expiresIn: 60 * 5 },
    );

    return NextResponse.redirect(signedUrl, 302);
  } catch (error: any) {
    console.error('[patient-medical-records-file] failed', error);
    return json({ ok: false, error: error?.message || 'medical_record_file_failed' }, 500);
  }
}
