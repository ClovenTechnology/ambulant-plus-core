import {
  NextResponse,
  type NextRequest,
} from 'next/server';

const RULES: Array<{
  prefix: string;
  required: string[];
}> = [
  {
    prefix:
      '/settings/people/role-requests',
    required: [
      'manageRoles',
      'hr',
    ],
  },
  {
    prefix:
      '/settings/roles',
    required: [
      'manageRoles',
    ],
  },
  {
    prefix:
      '/settings/people',
    required: [
      'hr',
    ],
  },
  {
    prefix:
      '/admin',
    required: [
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix:
      '/clinicians',
    required: [
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix:
      '/finance',
    required: [
      'finance',
    ],
  },
  {
    prefix:
      '/tech',
    required: [
      'tech',
    ],
  },
  {
    prefix:
      '/compliance',
    required: [
      'compliance',
    ],
  },
  {
    prefix:
      '/reports',
    required: [
      'reports',
    ],
  },
  {
    prefix:
      '/rnd',
    required: [
      'rnd',
    ],
  },
];

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
      ? 'https://api-gateway.ambulantplus.co.za'
      : 'http://localhost:3010'
  );

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string | null;
    email: string | null;
    name?: string | null;
    roles?: string[];
    scopes?: string[];
  };
};

function gatewayBase() {
  return String(APIGW || '')
    .replace(/\/+$/, '');
}

function canonicalAuthority(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function isPublicPath(
  pathname: string,
) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth/signin') ||
    pathname.startsWith('/auth/signup') ||
    pathname.startsWith('/auth/signout') ||
    pathname.startsWith('/signout') ||
    pathname.startsWith('/forbidden')
  );
}

async function fetchMe(
  request: NextRequest,
): Promise<MeResponse | null> {
  try {
    const response =
      await fetch(
        gatewayBase() +
          '/api/auth/me',
        {
          method:
            'GET',
          headers: {
            cookie:
              request.headers.get(
                'cookie',
              ) || '',
            'x-admin-origin':
              request.nextUrl.origin,
          },
          cache:
            'no-store',
        },
      );

    if (!response.ok) {
      return null;
    }

    const text =
      await response.text();

    return text
      ? JSON.parse(
          text,
        ) as MeResponse
      : null;
  }
  catch {
    return null;
  }
}

function hasRequiredAuthority(
  scopes: string[],
  required: string[],
) {
  const canonicalScopes =
    new Set(
      scopes.map(
        canonicalAuthority,
      ),
    );

  if (
    scopes.includes('*') ||
    canonicalScopes.has(
      'adminall',
    ) ||
    canonicalScopes.has(
      'superadmin',
    )
  ) {
    return true;
  }

  return required.some(
    (requiredScope) =>
      scopes.includes(
        requiredScope,
      ) ||
      canonicalScopes.has(
        canonicalAuthority(
          requiredScope,
        ),
      ),
  );
}

function redirectToSignin(
  request: NextRequest,
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    '/auth/signin';

  url.search =
    `?next=${encodeURIComponent(
      request.nextUrl.pathname +
        request.nextUrl.search,
    )}`;

  return NextResponse.redirect(
    url,
  );
}

function redirectForbidden(
  request: NextRequest,
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    '/forbidden';

  url.search =
    '';

  return NextResponse.redirect(
    url,
  );
}

export async function middleware(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const rule =
    RULES.find(
      (candidate) =>
        pathname.startsWith(
          candidate.prefix,
        ),
    );

  /*
   * Every non-public Admin Dashboard page requires
   * a signed session that resolves to a live,
   * approved AdminUserProfile.
   *
   * A route-specific rule adds scope enforcement;
   * the absence of a rule does not make a page public.
   */
  const session =
    await fetchMe(
      request,
    );

  if (
    !session?.authenticated ||
    !session.user?.email
  ) {
    return redirectToSignin(
      request,
    );
  }

  if (!rule) {
    return NextResponse.next();
  }

  const scopes =
    Array.isArray(
      session.user.scopes,
    )
      ? session.user.scopes
      : [];

  if (
    hasRequiredAuthority(
      scopes,
      rule.required,
    )
  ) {
    return NextResponse.next();
  }

  return redirectForbidden(
    request,
  );
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|ico|svg)).*)',
  ],
};