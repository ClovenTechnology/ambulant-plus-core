import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import {
  cleanText,
  serializeStaffProfile,
  staffAuditData,
  staffProfileInclude,
} from '@/src/lib/admin-staff-data';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELF_FIELDS = new Set([
  'phone',
  'timezone',
  'workingHours',
  'preferredContactMethod',
]);
const MANAGED_FIELDS = new Set([
  ...SELF_FIELDS,
  'name',
  'staffIdentifier',
  'departmentId',
  'designationId',
  'managerId',
]);

function bodyKeys(body: Record<string, unknown>) {
  return Object.keys(body).filter((key) => body[key] !== undefined);
}

function contactMethod(value: unknown) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toUpperCase();
  return ['IN_APP', 'EMAIL', 'MOBILE'].includes(v) ? v : undefined;
}

function safeWorkingHours(value: unknown) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const text = JSON.stringify(value);
  if (text.length > 12000) return undefined;
  return value as Record<string, unknown>;
}

async function wouldCreateManagerCycle(targetId: string, managerId: string) {
  let cursor: string | null = managerId;
  const seen = new Set<string>();
  for (let depth = 0; cursor && depth < 50; depth += 1) {
    if (cursor === targetId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const row: { managerId: string | null } | null = await prisma.adminUserProfile.findUnique({
      where: { id: cursor },
      select: { managerId: true },
    });
    cursor = row?.managerId || null;
  }
  return false;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const id = String(params.id || '').trim();
    const profile = await prisma.adminUserProfile.findUnique({
      where: { id },
      include: staffProfileInclude,
    });

    if (!profile) {
      requireStaffCapability(actor, 'staff.directory.read');
      const pending = await prisma.roleRequest.findUnique({
        where: { id },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          roles: { include: { role: { include: { scopes: true } } } },
        },
      });
      if (!pending || pending.status !== 'pending') {
        return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        item: {
          kind: 'pending',
          id: pending.id,
          name: pending.name || pending.email,
          email: pending.email,
          lifecycleState: 'PENDING',
          department: pending.department,
          designation: pending.designation,
          roles: pending.roles.map((entry) => ({
            id: entry.role.id,
            name: entry.role.name,
            scopes: entry.role.scopes.map((scope) => scope.scope),
          })),
          createdAt: pending.createdAt,
          updatedAt: pending.updatedAt,
        },
        permissions: {
          self: false,
          canManage: hasStaffCapability(actor, 'staff.manage'),
          canManageRoles: hasStaffCapability(actor, 'staff.roles.manage'),
        },
      }, { headers: { 'cache-control': 'no-store' } });
    }

    const self = profile.id === actor.profileId;
    const managerAccess = profile.manager?.id === actor.profileId;
    if (!self && !managerAccess) requireStaffCapability(actor, 'staff.directory.read');
    const canManage = hasStaffCapability(actor, 'staff.manage');
    const canReadAudit = canManage || hasStaffCapability(actor, 'meetings.audit.read') || actor.scopes.includes('compliance.audit.read');

    const [credential, audit] = await Promise.all([
      canManage || self
        ? prisma.adminAuthCredential.findUnique({
            where: { email: profile.email },
            select: { mustResetPassword: true, lastLoginAt: true, createdAt: true, updatedAt: true },
          })
        : Promise.resolve(null),
      canReadAudit
        ? prisma.auditLog.findMany({
            where: { entityType: 'AdminUserProfile', entityId: profile.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              createdAt: true,
              actorUserId: true,
              action: true,
              description: true,
              meta: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      ok: true,
      item: serializeStaffProfile(profile),
      security: credential ? {
        credentialPresent: true,
        mustResetPassword: credential.mustResetPassword,
        lastLoginAt: credential.lastLoginAt,
      } : { credentialPresent: false, mustResetPassword: null, lastLoginAt: null },
      audit,
      permissions: {
        self,
        managerAccess,
        canManage,
        canManageRoles: hasStaffCapability(actor, 'staff.roles.manage'),
        canUseCommunications: hasStaffCapability(actor, 'communications.use'),
        canCreateMeetings: hasStaffCapability(actor, 'meetings.create'),
      },
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin staff] detail failed', error);
    return NextResponse.json({ ok: false, error: 'staff_detail_failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    const id = String(params.id || '').trim();
    const target = await prisma.adminUserProfile.findUnique({ where: { id }, select: { id: true, managerId: true } });
    if (!target) return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });

    const self = target.id === actor.profileId;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const keys = bodyKeys(body);
    const allowed = self ? SELF_FIELDS : MANAGED_FIELDS;
    const forbidden = keys.filter((key) => !allowed.has(key) && key !== 'roleIds');
    if (forbidden.length) {
      return NextResponse.json({ ok: false, error: 'unsupported_staff_fields', fields: forbidden }, { status: 400 });
    }
    if (!self) requireStaffCapability(actor, 'staff.manage');

    const wantsRoles = Object.prototype.hasOwnProperty.call(body, 'roleIds');
    if (wantsRoles) {
      if (self) return NextResponse.json({ ok: false, error: 'self_role_change_forbidden' }, { status: 403 });
      requireStaffCapability(actor, 'staff.roles.manage');
    }

    const data: any = {};
    if (Object.prototype.hasOwnProperty.call(body, 'name')) data.name = cleanText(body.name, 240);
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) data.phone = cleanText(body.phone, 40);
    if (Object.prototype.hasOwnProperty.call(body, 'staffIdentifier')) data.staffIdentifier = cleanText(body.staffIdentifier, 120);
    if (Object.prototype.hasOwnProperty.call(body, 'timezone')) data.timezone = cleanText(body.timezone, 120);
    if (Object.prototype.hasOwnProperty.call(body, 'preferredContactMethod')) {
      const value = contactMethod(body.preferredContactMethod);
      if (value === undefined) return NextResponse.json({ ok: false, error: 'invalid_preferred_contact_method' }, { status: 400 });
      data.preferredContactMethod = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'workingHours')) {
      const value = safeWorkingHours(body.workingHours);
      if (value === undefined) return NextResponse.json({ ok: false, error: 'invalid_working_hours' }, { status: 400 });
      data.workingHours = value;
    }

    const departmentId = Object.prototype.hasOwnProperty.call(body, 'departmentId') ? cleanText(body.departmentId, 120) : undefined;
    const designationId = Object.prototype.hasOwnProperty.call(body, 'designationId') ? cleanText(body.designationId, 120) : undefined;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (designationId !== undefined) data.designationId = designationId;

    if (designationId) {
      const designation = await prisma.designation.findUnique({ where: { id: designationId }, select: { departmentId: true } });
      if (!designation) return NextResponse.json({ ok: false, error: 'designation_not_found' }, { status: 400 });
      const intendedDepartment = departmentId === undefined
        ? (await prisma.adminUserProfile.findUnique({ where: { id }, select: { departmentId: true } }))?.departmentId
        : departmentId;
      if (intendedDepartment && designation.departmentId !== intendedDepartment) {
        return NextResponse.json({ ok: false, error: 'designation_department_mismatch' }, { status: 400 });
      }
      if (!intendedDepartment) data.departmentId = designation.departmentId;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'managerId')) {
      const managerId = cleanText(body.managerId, 120);
      if (managerId === id) return NextResponse.json({ ok: false, error: 'self_manager_forbidden' }, { status: 400 });
      if (managerId) {
        const manager = await prisma.adminUserProfile.findUnique({ where: { id: managerId }, select: { id: true, lifecycleState: true } });
        if (!manager || manager.lifecycleState === 'ARCHIVED') {
          return NextResponse.json({ ok: false, error: 'manager_not_available' }, { status: 400 });
        }
        if (await wouldCreateManagerCycle(id, managerId)) {
          return NextResponse.json({ ok: false, error: 'manager_cycle_forbidden' }, { status: 400 });
        }
      }
      data.managerId = managerId;
    }

    let roleIds: string[] | null = null;
    if (wantsRoles) {
      if (!Array.isArray(body.roleIds)) return NextResponse.json({ ok: false, error: 'role_ids_array_required' }, { status: 400 });
      roleIds = Array.from(new Set(body.roleIds.map((value) => cleanText(value, 120)).filter((value): value is string => Boolean(value))));
      const existing = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } });
      if (existing.length !== roleIds.length) return NextResponse.json({ ok: false, error: 'role_not_found' }, { status: 400 });
    }

    const before = await prisma.adminUserProfile.findUnique({
      where: { id },
      select: { name: true, phone: true, staffIdentifier: true, departmentId: true, designationId: true, managerId: true, timezone: true, workingHours: true, preferredContactMethod: true, roles: { select: { roleId: true } } },
    });

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.adminUserProfile.update({ where: { id }, data });
      }
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { adminUserId: id } });
        if (roleIds.length) {
          await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ adminUserId: id, roleId })) });
        }
      }
      await tx.auditLog.create({
        data: staffAuditData(request, actor, {
          action: 'admin.staff.profile.updated',
          entityId: id,
          description: self ? 'Staff self-service profile update' : 'Staff profile updated by authorised administrator',
          meta: {
            changedFields: keys,
            before,
            roleIdsAfter: roleIds,
          },
        }),
      });
    });

    const updated = await prisma.adminUserProfile.findUnique({ where: { id }, include: staffProfileInclude });
    return NextResponse.json({ ok: true, item: updated ? serializeStaffProfile(updated) : null });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    if (error?.code === 'P2002') return NextResponse.json({ ok: false, error: 'staff_identifier_conflict' }, { status: 409 });
    console.error('[admin staff] update failed', error);
    return NextResponse.json({ ok: false, error: 'staff_update_failed' }, { status: 500 });
  }
}
