import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const KIND_MAP: Record<string, string> = {
  'lab-report': 'lab-report',
  'imaging-report': 'imaging-report',
  prescription: 'prescription',
  referral: 'referral',
  'clinical-note': 'clinical-note',
  other: 'other',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function safeFileName(value: unknown) {
  const raw = clean(value || 'document', 180);
  return raw.replace(/[^a-zA-Z0-9.\-_ ()]/g, '_').replace(/\s+/g, ' ').trim() || 'document';
}

function extFromName(name: string) {
  const match = name.match(/\.([a-zA-Z0-9]{1,12})$/);
  return match ? match[1].toLowerCase() : 'bin';
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

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');
  return headers;
}

async function readPatientSession(req: NextRequest) {
  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
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

  const userId = clean(payload.userId || payload.uid || payload.id || payload.user?.id, 180);

  if (!patientId) return null;

  return {
    patientId,
    userId,
    displayName: clean(payload.displayName || payload.name || payload.profile?.name, 240),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await readPatientSession(req);
    if (!session) {
      return json({ ok: false, error: 'patient_session_required' }, 401);
    }

    const bucket = bucketName();
    if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return json(
        {
          ok: false,
          error: 'storage_not_configured',
          message: 'Secure document storage is not configured for this environment.',
        },
        503,
      );
    }

    const form = await req.formData().catch(() => null);
    if (!form) return json({ ok: false, error: 'multipart_form_required' }, 400);

    const file = form.get('file');
    if (!(file instanceof File)) return json({ ok: false, error: 'file_required' }, 400);

    const mimeType = clean(file.type || 'application/octet-stream', 120);
    if (!ALLOWED_TYPES.has(mimeType)) {
      return json(
        {
          ok: false,
          error: 'unsupported_file_type',
          allowedTypes: Array.from(ALLOWED_TYPES),
        },
        415,
      );
    }

    if (file.size <= 0) return json({ ok: false, error: 'empty_file' }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, error: 'file_too_large', maxBytes: MAX_BYTES }, 413);

    const originalName = safeFileName(file.name);
    const ext = extFromName(originalName);
    const documentKind = KIND_MAP[clean(form.get('documentKind'), 80)] || 'other';
    const title =
      clean(form.get('title'), 180) ||
      originalName.replace(/\.[^.]+$/, '').trim() ||
      'Uploaded document';
    const notes = clean(form.get('notes'), 1000) || null;

    const fileKey = [
      'patient-records',
      session.patientId,
      new Date().toISOString().slice(0, 10),
      `${crypto.randomUUID()}.${ext}`,
    ].join('/');

    const bytes = Buffer.from(await file.arrayBuffer());

    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: bytes,
        ContentType: mimeType,
        Metadata: {
          patientId: session.patientId,
          sourceApp: 'patient-app',
          sourceType: 'patient_upload',
          originalName: originalName.slice(0, 200),
        },
      }),
    );

    const created = await prisma.patientDocument.create({
      data: {
        patientId: session.patientId,
        encounterId: null,
        title,
        documentKind,
        sourceApp: 'patient-app',
        sourceType: 'patient_upload',
        fileKey,
        fileName: originalName,
        mimeType,
        sizeBytes: file.size,
        status: 'READY',
        linkedRecordType: 'patient-medical-record',
        linkedRecordId: session.patientId,
        notes,
        createdByUserId: session.userId || null,
        createdByRole: 'patient',
        relationshipId: null,
        meta: {
          uploadedBy: 'patient',
          originalName,
          storage: 's3',
        },
      },
    });

    return json(
      {
        ok: true,
        document: {
          id: created.id,
          title: created.title,
          documentKind: created.documentKind,
          fileName: created.fileName,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          createdAt: created.createdAt.toISOString(),
          downloadUrl: `/api/medical-records/file?documentId=${encodeURIComponent(created.id)}`,
        },
      },
      201,
    );
  } catch (error: any) {
    console.error('[patient-medical-records-upload] failed', error);
    return json({ ok: false, error: error?.message || 'medical_record_upload_failed' }, 500);
  }
}
