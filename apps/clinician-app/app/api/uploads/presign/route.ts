// apps/clinician-app/app/api/uploads/presign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/src/lib/prisma'; // optional - logs metadata in DB
import { authorizeAdminFromHeaders } from '@/src/lib/auth'; // optional use

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { fileName, contentType, purpose = 'upload', clinicianId } = body || {};

    if (!fileName || !contentType) {
      return NextResponse.json({ ok: false, error: 'fileName and contentType required' }, { status: 400 });
    }

    // sanitize and generate s3 key
    const safeName = (fileName || '').replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 200);
    const key = `uploads/${purpose}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const cmd = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'private',
    });

    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 }); // 5 minutes

    // optional: create DB row with PENDING_UPLOAD
    try {
      if ((prisma as any).clinicianFile) {
        await prisma.clinicianFile.create({
          data: {
            clinicianId: clinicianId ?? null,
            purpose,
            s3Key: key,
            fileName: fileName,
            mimeType: contentType,
            size: 0,
            scanStatus: 'PENDING_UPLOAD',
          },
        });
      }
    } catch (e) {
      console.warn('presign: prisma insert failed', e);
    }

    return NextResponse.json({ ok: true, uploadUrl: signedUrl, key });
  } catch (err: any) {
    console.error('presign error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
