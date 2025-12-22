// apps/clinician-app/app/api/uploads/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorizeAdminFromHeaders } from '@/src/lib/auth';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdminFromHeaders(req.headers);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });

    const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
    const signed = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 }); // 5 minutes
    return NextResponse.json({ ok: true, url: signed });
  } catch (err: any) {
    console.error('signed-url error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
