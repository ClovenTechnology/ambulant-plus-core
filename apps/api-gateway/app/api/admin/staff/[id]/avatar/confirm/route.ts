import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { cleanText, serializeStaffProfile, staffAuditData, staffProfileInclude } from '@/src/lib/admin-staff-data';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  enterpriseMediaObjectBelongsTo,
  managedEnterpriseMediaRef,
  validateEnterpriseMediaUploadInput,
  verifyEnterpriseMediaUpload,
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
      select: { id: true, photoUrl: true },
    });
    if (!target) return json({ ok: false, error: 'staff_not_found' }, 404);
    if (target.id !== actor.profileId) requireStaffCapability(actor, 'staff.manage');

    const body = await request.json().catch(() => ({}));
    const objectKey = cleanText((body as any)?.objectKey, 512) || '';
    if (!enterpriseMediaObjectBelongsTo({ objectKey, kind: 'staff-avatar', ownerId: target.id })) {
      return json({ ok: false, error: 'staff_avatar_object_invalid' }, 400);
    }
    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    await verifyEnterpriseMediaUpload({ objectKey, ...upload });

    const managedRef = managedEnterpriseMediaRef(objectKey);
    await prisma.$transaction(async (tx) => {
      await tx.adminUserProfile.update({
        where: { id: target.id },
        data: { photoUrl: managedRef },
      });
      await tx.auditLog.create({
        data: staffAuditData(request, actor, {
          action: 'admin.staff.avatar.updated',
          entityId: target.id,
          description: target.id === actor.profileId ? 'Staff profile photo updated' : 'Staff profile photo updated by administrator',
        }),
      });
    });

    if (target.photoUrl && target.photoUrl !== managedRef) {
      await bestEffortDeleteManagedEnterpriseMedia(target.photoUrl);
    }
    const updated = await prisma.adminUserProfile.findUnique({ where: { id: target.id }, include: staffProfileInclude });
    return json({ ok: true, item: updated ? serializeStaffProfile(updated) : null });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin staff] avatar confirm failed', error);
    return json({ ok: false, error: 'staff_avatar_confirm_failed' }, 500);
  }
}
