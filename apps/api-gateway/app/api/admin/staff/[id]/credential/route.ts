import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { staffAuditData } from '@/src/lib/admin-staff-data';
import {
  hashAdminPassword,
  validateAdminPassword,
} from '@/src/lib/admin-password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    requireStaffCapability(actor, 'staff.credentials.manage');

    const id = String(params.id || '').trim();
    if (!id) return json({ ok: false, error: 'staff_not_found' }, 404);
    if (id === actor.profileId) {
      return json({ ok: false, error: 'self_credential_provision_forbidden' }, 403);
    }

    const target = await prisma.adminUserProfile.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        userId: true,
        lifecycleState: true,
      },
    });
    if (!target) return json({ ok: false, error: 'staff_not_found' }, 404);
    if (
      target.lifecycleState === 'SUSPENDED' ||
      target.lifecycleState === 'ARCHIVED'
    ) {
      return json({ ok: false, error: 'staff_account_unavailable' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    const validation = validateAdminPassword(password);
    if (!validation.ok) {
      return json({ ok: false, error: validation.error }, 400);
    }

    const email = String(target.email || '').trim().toLowerCase();
    const existing = await prisma.adminAuthCredential.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return json({ ok: false, error: 'admin_credential_already_exists' }, 409);
    }

    const credential = await prisma.adminAuthCredential.create({
      data: {
        email,
        passwordHash: hashAdminPassword(password),
        mustResetPassword: false,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: staffAuditData(request, actor, {
        action: 'admin.staff.credential.provisioned',
        entityId: target.id,
        description: 'Password sign-in credential provisioned for Staff account',
        meta: {
          staffUserId: target.userId,
          credentialId: credential.id,
        },
      }),
    });

    return json({
      ok: true,
      credential: {
        present: true,
        email: credential.email,
        createdAt: credential.createdAt,
      },
    }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin staff] credential provision failed', error);
    return json({ ok: false, error: 'staff_credential_provision_failed' }, 500);
  }
}
