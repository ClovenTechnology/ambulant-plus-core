// apps/api-gateway/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Unified login:
 * - kind: 'admin' | 'patient' (default: patient)
 * - Admin: finds AdminUserProfile by email, sets adm.profile cookie for dashboard
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = (body?.kind ?? 'patient') as 'admin' | 'patient';
    const { email } = body ?? {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const userId = email.trim().toLowerCase();

    if (kind === 'admin') {
      const admin = await prisma.adminUserProfile.findFirst({
        where: { OR: [{ email: userId }, { userId }] },
        include: { department: true, designation: true },
      });
      if (!admin) return NextResponse.json({ error: 'not_found' }, { status: 404 });

      const token = `dev-token:${userId}:${Date.now()}`;

      cookies().set('adm.profile', encodeURIComponent(JSON.stringify({
        userId: admin.userId,
        email: admin.email,
        name: admin.name ?? undefined,
        departmentId: admin.departmentId ?? undefined,
        designationId: admin.designationId ?? undefined,
      })), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // secure: true,
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({
        ok: true,
        token,
        admin: {
          id: admin.id,
          userId: admin.userId,
          email: admin.email,
          name: admin.name,
          departmentId: admin.departmentId,
          departmentName: admin.department?.name ?? null,
          designationId: admin.designationId,
          designationName: admin.designation?.name ?? null,
        },
      });
    }

    // ---- patient (legacy/compat) ----
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const token = `dev-token:${userId}:${Date.now()}`;
    return NextResponse.json({ ok: true, token, profile });

  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
