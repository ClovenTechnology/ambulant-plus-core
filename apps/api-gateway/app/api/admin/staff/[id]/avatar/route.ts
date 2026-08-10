import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';
import { staffAuditData } from '@/src/lib/admin-staff-data';
import {
  bestEffortDeleteManagedEnterpriseMedia,
  enterpriseMediaErrorResponse,
  isManagedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  getEnterpriseMediaObject,
  enterpriseMediaResponseBody,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const target = await prisma.adminUserProfile.findUnique({
      where: { id: context.params.id },
      select: { id: true, managerId: true, photoUrl: true },
    });
    if (!target) return json({ ok: false, error: 'staff_not_found' }, 404);
    const self = target.id === actor.profileId;
    const managerAccess = target.managerId === actor.profileId;
    if (!self && !managerAccess && !hasStaffCapability(actor, 'staff.directory.read')) {
      return json({ ok: false, error: 'staff_capability_required' }, 403);
    }
    if (!target.photoUrl) return json({ ok: false, error: 'staff_avatar_not_found' }, 404);

    if (isManagedEnterpriseMediaRef(target.photoUrl)) {
      const objectKey = objectKeyFromManagedEnterpriseMediaRef(target.photoUrl);
      if (!objectKey) return json({ ok: false, error: 'staff_avatar_not_found' }, 404);
      const object = await getEnterpriseMediaObject(objectKey);
      return new Response(enterpriseMediaResponseBody(object.bytes), {
        status: 200,
        headers: {
          'content-type': object.contentType,
          'content-length': String(object.contentLength),
          'cache-control': 'private, no-store',
          ...(object.etag ? { etag: object.etag } : {}),
        },
      });
    }
    if (/^https:\/\//i.test(target.photoUrl)) return NextResponse.redirect(target.photoUrl, 302);
    return json({ ok: false, error: 'staff_avatar_not_found' }, 404);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin staff] avatar read failed', error);
    return json({ ok: false, error: 'staff_avatar_read_failed' }, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const target = await prisma.adminUserProfile.findUnique({
      where: { id: context.params.id },
      select: { id: true, photoUrl: true },
    });
    if (!target) return json({ ok: false, error: 'staff_not_found' }, 404);
    if (target.id !== actor.profileId) requireStaffCapability(actor, 'staff.manage');

    await prisma.$transaction(async (tx) => {
      await tx.adminUserProfile.update({ where: { id: target.id }, data: { photoUrl: null } });
      await tx.auditLog.create({
        data: staffAuditData(request, actor, {
          action: 'admin.staff.avatar.removed',
          entityId: target.id,
          description: target.id === actor.profileId ? 'Staff profile photo removed' : 'Staff profile photo removed by administrator',
        }),
      });
    });
    await bestEffortDeleteManagedEnterpriseMedia(target.photoUrl);
    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin staff] avatar delete failed', error);
    return json({ ok: false, error: 'staff_avatar_delete_failed' }, 500);
  }
}
