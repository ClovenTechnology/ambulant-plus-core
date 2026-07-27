import crypto from 'node:crypto';

const SESSION_ISSUER =
  'ambulant-api-gateway';

const SESSION_AUDIENCE =
  'ambulant-admin-dashboard';

export type LegacyAdminSessionPayload = {
  sub: string;
  role: 'admin' | 'admin_staff';
  authMethod?: 'password' | 'legacy';
  email: string;
  name?: string | null;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
};

function sessionSecret() {
  return String(
    process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      '',
  ).trim();
}

function decodeJson(value: string) {
  try {
    return JSON.parse(
      Buffer.from(
        value,
        'base64url',
      ).toString('utf8'),
    ) as Record<string, unknown>;
  }
  catch {
    return null;
  }
}

function safeEqual(
  left: string,
  right: string,
) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(
      a,
      b,
    )
  );
}

function isAdminRole(
  value: unknown,
): value is LegacyAdminSessionPayload['role'] {
  return (
    value === 'admin' ||
    value === 'admin_staff'
  );
}

function tokenText(
  token?: string | null,
) {
  const raw =
    String(token || '').trim();

  try {
    return decodeURIComponent(
      raw,
    );
  }
  catch {
    return raw;
  }
}

export function verifyLegacyAdminSessionToken(
  token?: string | null,
): LegacyAdminSessionPayload | null {
  try {
    const secret =
      sessionSecret();

    if (!secret) {
      return null;
    }

    const parts =
      tokenText(token).split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [
      encodedHeader,
      encodedPayload,
      signature,
    ] = parts;

    const header =
      decodeJson(
        encodedHeader,
      );

    const payload =
      decodeJson(
        encodedPayload,
      );

    if (
      !header ||
      !payload ||
      String(
        header.alg ||
          '',
      ).toUpperCase() !==
        'HS256'
    ) {
      return null;
    }

    const expected =
      crypto
        .createHmac(
          'sha256',
          secret,
        )
        .update(
          encodedHeader +
            '.' +
            encodedPayload,
        )
        .digest(
          'base64url',
        );

    if (
      !safeEqual(
        signature,
        expected,
      )
    ) {
      return null;
    }

    const now =
      Math.floor(
        Date.now() /
          1000,
      );

    const sub =
      String(
        payload.sub ||
          '',
      ).trim();

    const email =
      String(
        payload.email ||
          '',
      )
        .trim()
        .toLowerCase();

    const role =
      payload.role;

    const exp =
      Number(
        payload.exp ||
          0,
      );

    const iat =
      Number(
        payload.iat ||
          0,
      );

    if (
      !sub ||
      !email ||
      !isAdminRole(role)
    ) {
      return null;
    }

    if (
      payload.iss !==
        SESSION_ISSUER ||
      payload.aud !==
        SESSION_AUDIENCE
    ) {
      return null;
    }

    if (
      !Number.isFinite(
        exp,
      ) ||
      exp <= now ||
      !Number.isFinite(
        iat,
      ) ||
      iat > now + 60
    ) {
      return null;
    }

    const name =
      String(
        payload.name ||
          '',
      ).trim() ||
      null;

    return {
      ...payload,
      sub,
      email,
      role,
      name,
      iss:
        SESSION_ISSUER,
      aud:
        SESSION_AUDIENCE,
      iat,
      exp,
    } as LegacyAdminSessionPayload;
  }
  catch {
    return null;
  }
}
export type SignLegacyAdminSessionInput = {
  sub: string;
  email: string;
  name?: string | null;
  role?: LegacyAdminSessionPayload['role'];
  authMethod?: 'password' | 'legacy';
};

function encodeSessionJson(
  value: Record<string, unknown>,
) {
  return Buffer.from(
    JSON.stringify(value),
    'utf8',
  ).toString('base64url');
}

export function signLegacyAdminSessionToken(
  input: SignLegacyAdminSessionInput,
  ttlSeconds = 60 * 60 * 8,
) {
  const secret =
    sessionSecret();

  if (!secret) {
    throw new Error(
      'admin_session_secret_not_configured',
    );
  }

  const sub =
    String(input.sub || '').trim();

  const email =
    String(input.email || '')
      .trim()
      .toLowerCase();

  const role =
    input.role || 'admin_staff';

  if (
    !sub ||
    !email ||
    !isAdminRole(role)
  ) {
    throw new Error(
      'invalid_admin_session_subject',
    );
  }

  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const safeTtl =
    Math.max(
      300,
      Math.min(
        Math.floor(ttlSeconds),
        60 * 60 * 24,
      ),
    );

  const encodedHeader =
    encodeSessionJson({
      alg: 'HS256',
      typ: 'JWT',
    });

  const encodedPayload =
    encodeSessionJson({
      sub,
      email,
      name:
        String(input.name || '').trim() ||
        null,
      role,
      authMethod:
        input.authMethod ||
        'legacy',
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
      iat: now,
      exp: now + safeTtl,
    });

  const unsignedToken =
    encodedHeader +
    '.' +
    encodedPayload;

  const signature =
    crypto
      .createHmac(
        'sha256',
        secret,
      )
      .update(unsignedToken)
      .digest('base64url');

  return (
    unsignedToken +
    '.' +
    signature
  );
}
