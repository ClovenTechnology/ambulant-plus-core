import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  verifyAdminPassword,
} from '@/src/lib/admin-password';
import {
  signLegacyAdminSessionToken,
} from '@/src/lib/admin-session-compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ADMIN_SESSION_SECONDS =
  60 * 60 * 8;

function cleanEmail(
  value: unknown,
) {
  const email =
    String(value || '')
      .trim()
      .toLowerCase();

  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
      ? email
      : null
  );
}

function adminError(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
      headers: {
        'cache-control':
          'no-store',
      },
    },
  );
}

function secureCookie() {
  return (
    process.env.NODE_ENV ===
      'production' ||
    process.env.VERCEL_ENV ===
      'production'
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request
        .json()
        .catch(() => ({}));

    const kind =
      body?.kind === 'admin'
        ? 'admin'
        : 'patient';

    const email =
      cleanEmail(body?.email);

    if (!email) {
      return adminError(
        'valid_email_required',
        400,
      );
    }

    if (kind === 'admin') {
      const password =
        typeof body?.password ===
          'string'
          ? body.password
          : '';

      const [
        admin,
        credential,
      ] =
        await Promise.all([
          prisma.adminUserProfile.findFirst({
            where: {
              OR: [
                {
                  email,
                },
                {
                  userId: email,
                },
              ],
            },
            include: {
              department: true,
              designation: true,
            },
          }),
          prisma.adminAuthCredential.findUnique({
            where: {
              email,
            },
          }),
        ]);

      if (!admin) {
        const application =
          await prisma.roleRequest.findFirst({
            where: {
              email,
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              status: true,
            },
          });

        if (
          application?.status ===
          'pending'
        ) {
          return adminError(
            'admin_approval_pending',
            403,
          );
        }

        if (
          application?.status ===
          'denied'
        ) {
          return adminError(
            'admin_application_denied',
            403,
          );
        }

        return adminError(
          'invalid_credentials',
          401,
        );
      }

      if (credential) {
        if (
          !password ||
          !verifyAdminPassword(
            password,
            credential.passwordHash,
          )
        ) {
          return adminError(
            'invalid_credentials',
            401,
          );
        }

        if (
          credential.mustResetPassword
        ) {
          return adminError(
            'password_reset_required',
            403,
          );
        }
      }
      else {
        /*
         * Transitional compatibility for approved
         * Admin profiles created before credentials
         * were introduced.
         *
         * New applicants cannot reach this path:
         * approval must create a live profile, and
         * Sweep 1 already creates their credential.
         */
        console.warn(
          '[admin login] approved legacy profile has no credential',
          {
            profileId: admin.id,
          },
        );
      }

      const sessionToken =
        signLegacyAdminSessionToken(
          {
            sub: admin.userId,
            email: admin.email,
            name: admin.name,
            role: 'admin_staff',
            authMethod: credential ? 'password' : 'legacy',
          },
          ADMIN_SESSION_SECONDS,
        );

      cookies().set(
        'adm.profile',
        sessionToken,
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: secureCookie(),
          path: '/',
          maxAge:
            ADMIN_SESSION_SECONDS,
        },
      );

      if (credential) {
        await prisma.adminAuthCredential.update({
          where: {
            email,
          },
          data: {
            lastLoginAt:
              new Date(),
          },
        });
      }

      return NextResponse.json(
        {
          ok: true,
          admin: {
            id: admin.id,
            userId: admin.userId,
            email: admin.email,
            name: admin.name,
            departmentId:
              admin.departmentId,
            departmentName:
              admin.department?.name ??
              null,
            designationId:
              admin.designationId,
            designationName:
              admin.designation?.name ??
              null,
          },
        },
        {
          status: 200,
          headers: {
            'cache-control':
              'no-store',
          },
        },
      );
    }

    /*
     * Patient legacy compatibility is unchanged.
     */
    const profile =
      await prisma.patientProfile.findUnique({
        where: {
          userId: email,
        },
      });

    if (!profile) {
      return NextResponse.json(
        {
          error: 'not_found',
        },
        {
          status: 404,
        },
      );
    }

    const token =
      `dev-token:${email}:${Date.now()}`;

    return NextResponse.json({
      ok: true,
      token,
      profile,
    });
  }
  catch (error) {
    console.error(
      '[admin login] request failed',
      error,
    );

    return adminError(
      'admin_login_failed',
      500,
    );
  }
}