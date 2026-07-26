import {
  timingSafeEqual,
} from 'node:crypto';
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  prisma,
} from '@/lib/prisma';
import {
  hashAdminPassword,
  validateAdminPassword,
} from '@/src/lib/admin-password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

function safeEqual(
  left: string,
  right: string,
) {
  const a =
    Buffer.from(left);

  const b =
    Buffer.from(right);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function hasBootstrapAuthority(
  request: NextRequest,
) {
  const expected =
    String(
      process.env.ADMIN_API_KEY ||
      '',
    ).trim();

  const supplied =
    String(
      request.headers.get(
        'x-admin-key',
      ) ||
      '',
    ).trim();

  return (
    Boolean(expected) &&
    Boolean(supplied) &&
    safeEqual(
      supplied,
      expected,
    )
  );
}

export async function POST(
  request: NextRequest,
) {
  if (
    !String(
      process.env.ADMIN_API_KEY ||
      '',
    ).trim()
  ) {
    return json(
      {
        ok: false,
        error:
          'admin_credential_bootstrap_not_configured',
      },
      503,
    );
  }

  if (
    !hasBootstrapAuthority(request)
  ) {
    return json(
      {
        ok: false,
        error: 'unauthorized',
      },
      401,
    );
  }

  try {
    const body =
      await request
        .json()
        .catch(() => ({}));

    const email =
      String(body?.email || '')
        .trim()
        .toLowerCase();

    const password =
      String(body?.password || '');

    if (
      !email ||
      !email.includes('@')
    ) {
      return json(
        {
          ok: false,
          error: 'valid_email_required',
        },
        400,
      );
    }

    const validation =
      validateAdminPassword(password);

    if (!validation.ok) {
      return json(
        {
          ok: false,
          error: validation.error,
        },
        400,
      );
    }

    const admin =
      await prisma
        .adminUserProfile
        .findFirst({
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
          select: {
            id: true,
            userId: true,
            email: true,
          },
        });

    if (!admin) {
      return json(
        {
          ok: false,
          error:
            'existing_admin_profile_required',
        },
        404,
      );
    }

    const credentialEmail =
      String(admin.email || email)
        .trim()
        .toLowerCase();

    const existing =
      await prisma
        .adminAuthCredential
        .findUnique({
          where: {
            email: credentialEmail,
          },
          select: {
            id: true,
          },
        });

    if (existing) {
      return json(
        {
          ok: false,
          error:
            'admin_credential_already_exists',
        },
        409,
      );
    }

    await prisma
      .adminAuthCredential
      .create({
        data: {
          email: credentialEmail,
          passwordHash:
            hashAdminPassword(
              password,
            ),
          mustResetPassword: false,
        },
        select: {
          id: true,
        },
      });

    console.info(
      '[admin-auth][credential-bootstrap]',
      {
        adminUserId:
          admin.userId,
        email:
          credentialEmail,
        outcome:
          'credential_created',
      },
    );

    return json(
      {
        ok: true,
        status:
          'admin_credential_created',
        adminUserId:
          admin.userId,
        email:
          credentialEmail,
      },
      201,
    );
  }
  catch (error) {
    console.error(
      '[admin-auth][credential-bootstrap] failed',
      error,
    );

    return json(
      {
        ok: false,
        error:
          'admin_credential_bootstrap_failed',
      },
      500,
    );
  }
}