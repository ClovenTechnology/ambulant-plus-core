import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  enterpriseMediaErrorResponse,
  enterpriseMediaObjectKey,
  presignEnterpriseMediaUpload,
  validateEnterpriseMediaUploadInput,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function denied(req: NextRequest) {
  const expected = String(process.env.API_GATEWAY_ADMIN_KEY || '');
  const received = String(req.headers.get('x-admin-key') || '');
  if (!expected) return json({ ok: false, error: 'shop_admin_key_not_configured' }, 503);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ ok: false, error: 'shop_admin_required' }, 403);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const reject = denied(req);
  if (reject) return reject;

  try {
    const body = await req.json().catch(() => ({}));
    const targetKind = String(body.targetKind || '').trim().toLowerCase();
    const targetId = String(body.targetId || '').trim();
    if (!targetId || !['product', 'variant'].includes(targetKind)) {
      return json({ ok: false, error: 'valid_targetKind_and_targetId_required' }, 400);
    }

    const target =
      targetKind === 'product'
        ? await prisma.shopProduct.findUnique({ where: { id: targetId }, select: { id: true } })
        : await prisma.shopVariant.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return json({ ok: false, error: 'shop_media_target_not_found' }, 404);

    const upload = validateEnterpriseMediaUploadInput({
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
    });
    const kind =
      targetKind === 'product' ? 'shop-product-image' : 'shop-variant-image';
    const objectKey = enterpriseMediaObjectKey({ kind, ownerId: targetId });
    const signed = await presignEnterpriseMediaUpload({
      objectKey,
      contentType: upload.contentType,
      checksumSha256: upload.checksumSha256,
    });

    return json({ ok: true, objectKey, ...signed });
  } catch (error) {
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[shop media] presign failed', error);
    return json({ ok: false, error: 'shop_media_presign_failed' }, 500);
  }
}
