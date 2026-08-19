import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  hashAdminPassword,
  validateAdminPassword,
  verifyAdminPassword,
} from '@/src/lib/admin-password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const body = await request.json().catch(() => ({}));

    const currentPassword =
      typeof body?.currentPassword === 'string'
        ? body.currentPassword
        : '';
    const newPassword =
      typeof body?.newPassword === 'string'
        ? body.newPassword
        : '';

    const validation = validateAdminPassword(newPassword);
    if (!validation.ok) {
      return json({ ok: false, error: validation.error }, 400);
    }

    const email = String(actor.email || '').trim().toLowerCase();
    const credential = await prisma.adminAuthCredential.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!credential) {
      return json({ ok: false, error: 'admin_credential_setup_required' }, 409);
    }

    if (
      !currentPassword ||
      !verifyAdminPassword(currentPassword, credential.passwordHash)
    ) {
      return json({ ok: false, error: 'current_password_invalid' }, 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminAuthCredential.update({
        where: { id: credential.id },
        data: {
          passwordHash: hashAdminPassword(newPassword),
          mustResetPassword: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'ADMIN',
          actorRefId: actor.profileId,
          app: 'admin-dashboard',
          action: 'admin.staff.password.changed',
          entityType: 'AdminUserProfile',
          entityId: actor.profileId,
          description: 'Staff sign-in password changed',
          meta: {},
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    });

    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin auth] password change failed', error);
    return json({ ok: false, error: 'admin_password_change_failed' }, 500);
  }
}
