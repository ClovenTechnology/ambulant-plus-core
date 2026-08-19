import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
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

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const target = await prisma.adminUserProfile.findUnique({
      where: { id: context.params.id },
      select: { id: true },
    });
    if (!target) return json({ ok: false, error: 'staff_not_found' }, 404);
    if (target.id !== actor.profileId) requireStaffCapability(actor, 'staff.hr.manage');

    const body = await request.json().catch(() => ({}));
    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    const objectKey = enterpriseMediaObjectKey({ kind: 'staff-avatar', ownerId: target.id });
    const signed = await presignEnterpriseMediaUpload({
      objectKey,
      contentType: upload.contentType,
      checksumSha256: upload.checksumSha256,
    });
    return json({ ok: true, objectKey, ...signed });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin staff] avatar presign failed', error);
    return json({ ok: false, error: 'staff_avatar_presign_failed' }, 500);
  }
}
