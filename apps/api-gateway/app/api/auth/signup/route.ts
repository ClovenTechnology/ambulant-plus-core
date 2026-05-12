// apps/api-gateway/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Unified signup:
 * - kind: 'admin' | 'patient' default: patient
 * - Admin: creates AdminUserProfile and sets adm.profile cookie for dashboard
 * - Patient: legacy patientProfile upsert kept for compatibility
 */

function cleanEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  return s.includes('@') ? s : null;
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const kind = (body?.kind ?? 'patient') as 'admin' | 'patient';

    if (kind === 'admin') {
      const email = cleanEmail(body?.email);
      const name = cleanStr(body?.name);
      const departmentId = cleanStr(body?.departmentId);
      const designationId = cleanStr(body?.designationId);

      if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
      }

      const userId = email;

      /*
       * AdminUserProfile in the current Prisma schema does not expose:
       * - phone
       * - department relation
       * - designation relation
       *
       * Keep this route aligned to the generated client:
       * id, userId, email, name, departmentId, designationId.
       */
      const admin = await prisma.adminUserProfile.upsert({
        where: { email: userId },
        update: {
          name: name ?? undefined,
          departmentId: departmentId ?? undefined,
          designationId: designationId ?? undefined,
        },
        create: {
          userId,
          email: userId,
          name: name ?? null,
          departmentId: departmentId ?? null,
          designationId: designationId ?? null,
        },
      });

      const token = `dev-token:${userId}:${Date.now()}`;

      cookies().set(
        'adm.profile',
        encodeURIComponent(
          JSON.stringify({
            userId: admin.userId,
            email: admin.email,
            name: admin.name ?? undefined,
            departmentId: admin.departmentId ?? undefined,
            designationId: admin.designationId ?? undefined,
          }),
        ),
        {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        },
      );

      return NextResponse.json(
        {
          ok: true,
          token,
          admin: {
            id: admin.id,
            userId: admin.userId,
            email: admin.email,
            name: admin.name,
            departmentId: admin.departmentId,
            departmentName: null,
            designationId: admin.designationId,
            designationName: null,
          },
        },
        { status: 201 },
      );
    }

    // ---- patient legacy/compat signup ----
    const email = cleanEmail(body?.email);
    const name = cleanStr(body?.name);
    const phone = cleanStr(body?.phone);

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const userId = email;

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

    return NextResponse.json(
      {
        ok: true,
        profile,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('auth signup error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'signup_failed',
      },
      { status: 500 },
    );
  }
}