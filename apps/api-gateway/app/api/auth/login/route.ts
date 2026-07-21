import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  signAdminSessionToken,
} from '@/src/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function cleanEmail(value: unknown) {
  const email = String(value || '')
    .trim()
    .toLowerCase();

  return email.includes('@')
    ? email
    : null;
}

async function verifyPasswordWithAuth0(
  email: string,
  password: string,
  kind: 'admin' | 'patient',
) {
  const domain = process.env.AUTH0_DOMAIN || '';
  const clientId =
    kind === 'admin'
      ? (
          process.env.AUTH0_ADMIN_ROPG_CLIENT_ID ||
          process.env.AUTH0_ROPG_CLIENT_ID ||
          ''
        )
      : process.env.AUTH0_ROPG_CLIENT_ID || '';
  const clientSecret =
    kind === 'admin'
      ? (
          process.env.AUTH0_ADMIN_ROPG_CLIENT_SECRET ||
          process.env.AUTH0_ROPG_CLIENT_SECRET ||
          ''
        )
      : process.env.AUTH0_ROPG_CLIENT_SECRET || '';
  const realm =
    kind === 'admin'
      ? (
          process.env.AUTH0_ADMIN_DB_CONNECTION ||
          process.env.AUTH0_DB_CONNECTION ||
          'Username-Password-Authentication'
        )
      : (
          process.env.AUTH0_DB_CONNECTION ||
          'Username-Password-Authentication'
        );

  if (!domain || !clientId || !clientSecret) {
    return {
      configured: false,
      ok: false,
    };
  }

  const response = await fetch(
    `https://${domain}/oauth/token`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        grant_type:
          'http://auth0.com/oauth/grant-type/password-realm',
        realm,
        username: email,
        password,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'openid profile email',
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return {
      configured: true,
      ok: false,
    };
  }

  const body =
    await response.json().catch(() => null);

  return {
    configured: true,
    ok: Boolean(
      body?.id_token ||
      body?.access_token,
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body =
      await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json(
        {
          ok: false,
          error: 'invalid_request_body',
        },
        400,
      );
    }

    const kind =
      body.kind === 'admin'
        ? 'admin'
        : 'patient';
    const email = cleanEmail(body.email);
    const password = String(body.password || '');

    if (!email) {
      return json(
        { ok: false, error: 'email_required' },
        400,
      );
    }

    if (!password) {
      return json(
        { ok: false, error: 'password_required' },
        400,
      );
    }

    const passwordResult =
      await verifyPasswordWithAuth0(
        email,
        password,
        kind,
      );

    if (!passwordResult.configured) {
      return json(
        {
          ok: false,
          error: 'password_authentication_not_configured',
        },
        503,
      );
    }

    if (!passwordResult.ok) {
      return json(
        {
          ok: false,
          error: 'invalid_email_or_password',
        },
        401,
      );
    }

    if (kind === 'admin') {
      const admin =
        await prisma.adminUserProfile.findFirst({
          where: {
            OR: [
              { email },
              { userId: email },
            ],
          },
          include: {
            department: true,
            designation: true,
          },
        });

      if (!admin) {
        return json(
          {
            ok: false,
            error: 'admin_access_not_provisioned',
          },
          403,
        );
      }

      const sessionToken =
        signAdminSessionToken({
          sub: admin.userId,
          role: 'admin',
          email: admin.email,
          name: admin.name,
          profileId: admin.id,
          departmentId: admin.departmentId,
          designationId: admin.designationId,
        });

      cookies().set(
        ADMIN_SESSION_COOKIE,
        sessionToken,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge:
            ADMIN_SESSION_MAX_AGE_SECONDS,
        },
      );

      return json({
        ok: true,
        token: 'session-established',
        admin: {
          id: admin.id,
          userId: admin.userId,
          email: admin.email,
          name: admin.name,
          departmentId: admin.departmentId,
          departmentName:
            admin.department?.name ?? null,
          designationId: admin.designationId,
          designationName:
            admin.designation?.name ?? null,
        },
      });
    }

    const profile =
      await prisma.patientProfile.findUnique({
        where: {
          userId: email,
        },
      });

    if (!profile) {
      return json(
        {
          ok: false,
          error: 'invalid_email_or_password',
        },
        401,
      );
    }

    return json({
      ok: true,
      token: 'authentication-confirmed',
      profile,
    });
  }
  catch (error) {
    console.error('login error', error);

    return json(
      {
        ok: false,
        error: 'login_failed',
      },
      500,
    );
  }
}
