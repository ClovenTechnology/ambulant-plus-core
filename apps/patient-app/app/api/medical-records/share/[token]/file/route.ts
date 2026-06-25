import crypto from 'crypto';
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

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
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

async function resolveShare(token: string) {
  const hash = tokenHash(token);

  const created = await prisma.auditEvent.findFirst({
    where: { kind: 'medical_record_share_created', subjectId: hash },
    orderBy: { at: 'desc' },
  });

  if (!created) return null;

  const revoked = await prisma.auditEvent.findFirst({
    where: { kind: 'medical_record_share_revoked', subjectId: hash },
    orderBy: { at: 'desc' },
  });

  if (revoked) return null;

  const meta = created.meta as any;
  const expiresAt = new Date(String(meta?.expiresAt || ''));
  if (!meta?.patientId || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null;

  return { hash, meta };
}

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const token = clean(ctx.params.token, 500);
    const share = await resolveShare(token);
    if (!share) return json({ ok: false, error: 'share_expired_or_not_found' }, 404);

    const url = new URL(req.url);
    const documentId = clean(url.searchParams.get('documentId'), 180);
    if (!documentId) return json({ ok: false, error: 'documentId_required' }, 400);

    const scope = String(share.meta.scope || 'documents_only');
    const selectedDocumentIds = Array.isArray(share.meta.selectedDocumentIds) ? share.meta.selectedDocumentIds : [];

    if (scope === 'labs_only') return json({ ok: false, error: 'documents_not_in_scope' }, 403);
    if (scope === 'selected_documents' && !selectedDocumentIds.includes(documentId)) {
      return json({ ok: false, error: 'document_not_in_scope' }, 403);
    }

    const doc = await prisma.patientDocument.findFirst({
      where: {
        id: documentId,
        patientId: String(share.meta.patientId),
      },
      select: {
        id: true,
        fileKey: true,
        fileName: true,
        mimeType: true,
      },
    });

    if (!doc) return json({ ok: false, error: 'document_not_found' }, 404);

    await prisma.auditEvent.create({
      data: {
        kind: 'medical_record_share_file_accessed',
        actorId: null,
        actorRole: 'share_viewer',
        subjectId: share.hash,
        meta: {
          patientId: share.meta.patientId,
          documentId,
          accessedAt: new Date().toISOString(),
          userAgent: req.headers.get('user-agent') || null,
        },
      },
    });

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
    console.error('[medical-records-share-file] failed', error);
    return json({ ok: false, error: error?.message || 'medical_record_share_file_failed' }, 500);
  }
}
