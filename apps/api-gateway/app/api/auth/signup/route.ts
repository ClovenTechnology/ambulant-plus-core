// apps/api-gateway/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Unified signup:
 * - kind: 'admin' | 'patient' (default: patient)
 * - Admin: creates AdminUserProfile (+ optional department/designation),
 *          sets adm.profile cookie for dashboard
 * - Patient: legacy patientProfile upsert (kept for compat)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = (body?.kind ?? 'patient') as 'admin' | 'patient';

    if (kind === 'admin') {
      const { email, name, departmentId, designationId, phone } = body ?? {};
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }
      const userId = email.trim().toLowerCase();

      // create or update admin profile
      const admin = await prisma.adminUserProfile.upsert({
        where: { email: userId },
        update: {
          name: name ?? undefined,
          phone: phone ?? undefined,
          departmentId: departmentId ?? undefined,
          designationId: designationId ?? undefined,
        },
        create: {
          userId,
          email: userId,
          name: name ?? null,
          phone: phone ?? null,
          departmentId: departmentId ?? null,
          designationId: designationId ?? null,
        },
        include: { department: true, designation: true },
      });

      // dev token
      const token = `dev-token:${userId}:${Date.now()}`;

      // Set adm.profile cookie (httpOnly so client fetches /api/auth/me for details)
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
        // secure: true, // enable in production
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
      }, { status: 201 });
    }

    // ---- patient (legacy/compat) ----
    const { email, name, phone } = body ?? {};
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const userId = email.trim().toLowerCase();

    const profile = await prisma.patientProfile.upsert({
      where: { userId },
      update: {
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
      },
    });

    const token = `dev-token:${userId}:${Date.now()}`;
    return NextResponse.json({ ok: true, token, profile });

  } catch (err) {
    console.error('signup error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
