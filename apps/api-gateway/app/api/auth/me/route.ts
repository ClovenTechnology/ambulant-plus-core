// apps/api-gateway/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
  const allRoleNames = Array.from(new Set([...fromDesignation, ...directRoles].map(r => r.name)));
  const allScopes = Array.from(
    new Set(
      [...fromDesignation, ...directRoles]
        .flatMap(r => r.scopes.map(s => s.scope))
    )
  );

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
  // Expect cookie adm.profile = encodeURIComponent(JSON.stringify({userId?, email?, name?}))
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
