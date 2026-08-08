import { NextRequest } from 'next/server';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import { effectivePresence } from '@/src/lib/admin-staff-policy';

export function cleanText(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

export function cleanEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function auditContext(request: NextRequest) {
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent') || null,
  };
}

export function staffAuditData(
  request: NextRequest,
  actor: AdminStaffActor,
  input: {
    action: string;
    entityId: string;
    description?: string | null;
    meta?: Record<string, unknown>;
  },
): any {
  const ctx = auditContext(request);
  return {
    actorUserId: actor.userId,
    actorType: 'ADMIN' as const,
    actorRefId: actor.profileId,
    app: 'admin-dashboard',
    action: input.action,
    entityType: 'AdminUserProfile',
    entityId: input.entityId,
    description: input.description || null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    meta: input.meta || {},
  };
}

export function serializeStaffProfile(profile: any, now = new Date()) {
  const designationRoles = (profile.designation?.roles || []).map((entry: any) => entry.role);
  const directRoles = (profile.roles || []).map((entry: any) => entry.role);
  const roles = Array.from(new Map(
    [...designationRoles, ...directRoles].map((role: any) => [role.id || role.name, role]),
  ).values()).map((role: any) => ({
    id: role.id,
    name: role.name,
    scopes: (role.scopes || []).map((entry: any) => entry.scope),
  }));
  const scopes = Array.from(new Set(roles.flatMap((role: any) => role.scopes)));
  return {
    kind: 'staff' as const,
    id: profile.id,
    userId: profile.userId,
    name: profile.name || profile.email,
    email: profile.email,
    phone: profile.phone,
    staffIdentifier: profile.staffIdentifier,
    photoUrl: profile.photoUrl,
    department: profile.department ? { id: profile.department.id, name: profile.department.name } : null,
    designation: profile.designation ? { id: profile.designation.id, name: profile.designation.name } : null,
    manager: profile.manager ? { id: profile.manager.id, name: profile.manager.name || profile.manager.email, email: profile.manager.email } : null,
    directReports: (profile.directReports || []).map((row: any) => ({ id: row.id, name: row.name || row.email, email: row.email })),
    roles,
    scopes,
    lifecycleState: profile.lifecycleState,
    timezone: profile.timezone,
    workingHours: profile.workingHours,
    preferredContactMethod: profile.preferredContactMethod,
    presence: effectivePresence(profile.presence, now),
    presenceExpiresAt: profile.presence?.expiresAt || null,
    presenceNote: profile.presence?.note || null,
    lastActivityAt: profile.lastActivityAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export const staffProfileInclude = {
  department: { select: { id: true, name: true } },
  designation: {
    select: {
      id: true,
      name: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              scopes: { select: { scope: true } },
            },
          },
        },
      },
    },
  },
  manager: { select: { id: true, name: true, email: true } },
  directReports: { select: { id: true, name: true, email: true } },
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          scopes: { select: { scope: true } },
        },
      },
    },
  },
  presence: true,
} as const;
