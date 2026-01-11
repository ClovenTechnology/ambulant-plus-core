// apps/api-gateway/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

async function getAllKnownScopes(): Promise<string[]> {
  // safest because prisma.role exists in your code already
  const roles = await prisma.role.findMany({
    select: { scopes: { select: { scope: true } } },
  });
  return Array.from(new Set(roles.flatMap(r => r.scopes.map(s => s.scope)).filter(Boolean)));
}

async function resolveEffectiveRolesAndScopes(userId?: string, email?: string) {
  if (!userId && !email) return { roles: [], scopes: [] as string[] };

  const profile = await prisma.adminUserProfile.findFirst({
    where: { OR: [{ userId: userId || '' }, { email: email || '' }] },
    select: {
      id: true,
      userId: true,
      email: true,
      name: true,
      departmentId: true,
      designationId: true,
      designation: {
        select: {
          id: true,
          roles: {
            select: { role: { select: { id: true, name: true, scopes: { select: { scope: true } } } } },
          },
        },
      },
      roles: {
        select: {
          role: { select: { id: true, name: true, scopes: { select: { scope: true } } } },
        },
      },
    },
  });

  if (!profile) return { roles: [], scopes: [] as string[] };

  const fromDesignation = (profile.designation?.roles ?? []).map(r => r.role);
  const directRoles = (profile.roles ?? []).map(r => r.role);

  const allRoleNames = Array.from(new Set([...fromDesignation, ...directRoles].map(r => r.name).filter(Boolean)));

  let allScopes = Array.from(
    new Set(
      [...fromDesignation, ...directRoles]
        .flatMap(r => r.scopes.map(s => s.scope))
        .filter(Boolean)
    )
  );

  // ✅ Super-admin expansion: if role includes "superadmin" OR scopes include admin:all / *
  const isSuper =
    allRoleNames.includes('superadmin') ||
    allScopes.includes('admin:all') ||
    allScopes.includes('*');

  if (isSuper) {
    allScopes = await getAllKnownScopes();
    // optional: keep sentinel scopes too (useful for client checks)
    allScopes = Array.from(new Set([...allScopes, 'admin:all', 'superadmin']));
    if (!allRoleNames.includes('superadmin')) allRoleNames.push('superadmin');
  }

  return {
    roles: allRoleNames,
    scopes: allScopes,
    profile: {
      id: profile.id,
      userId: profile.userId,
      email: profile.email,
      name: profile.name,
      departmentId: profile.departmentId,
      designationId: profile.designationId,
    },
  };
}

export async function GET() {
  const raw = cookies().get('adm.profile')?.value;
  if (!raw) return NextResponse.json({ authenticated: false }, { status: 200 });

  let parsed: any = {};
  try { parsed = JSON.parse(decodeURIComponent(raw)); } catch {}

  const { roles, scopes, profile } = await resolveEffectiveRolesAndScopes(parsed.userId, parsed.email);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: profile?.userId ?? parsed.userId ?? null,
      email: profile?.email ?? parsed.email ?? null,
      name: profile?.name ?? parsed.name ?? null,
      departmentId: profile?.departmentId ?? null,
      designationId: profile?.designationId ?? null,
      roles,
      scopes,
    },
  });
}
