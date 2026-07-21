import {
  NextResponse,
  type NextRequest,
} from 'next/server';

const RULES: Array<{
  prefix: string;
  required: string[];
}> = [
  {
    prefix: '/admin',
    required: [
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'medical',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix: '/clinicians',
    required: [
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'medical',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix: '/settings/roles',
    required: ['manageRoles'],
  },
  {
    prefix: '/settings/people',
    required: ['hr'],
  },
  {
    prefix: '/finance',
    required: ['finance'],
  },
  {
    prefix: '/tech',
    required: ['tech'],
  },
  {
    prefix: '/compliance',
    required: ['compliance'],
  },
  {
    prefix: '/reports',
    required: ['reports'],
  },
  {
    prefix: '/rnd',
    required: ['rnd'],
  },
];

const isPublicPath = (pathname: string) =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') ||
  pathname.startsWith('/auth/signin') ||
  pathname.startsWith('/auth/signup') ||
  pathname.startsWith('/signout');

const APIGW =
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.APIGW_BASE ||
  'http://localhost:3010';

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string | null;
    email: string | null;
    name?: string | null;
    departmentId?: string | null;
    designationId?: string | null;
    roles?: string[];
    scopes?: string[];
    superAdmin?: boolean;
  };
};

function canonicalAuthority(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function hasSuperAuthority(user: MeResponse['user']) {
  if (!user) return false;
  if (user.superAdmin === true) return true;

  const roles = Array.isArray(user.roles)
    ? user.roles
    : [];
  const scopes = Array.isArray(user.scopes)
    ? user.scopes
    : [];

  return (
    roles.some((role) =>
      canonicalAuthority(role) === 'superadmin',
    ) ||
    scopes.some((scope) => {
      const value = String(scope || '')
        .trim()
        .toLowerCase();

      return (
        value === '*' ||
        value === 'admin:all' ||
        canonicalAuthority(value) === 'superadmin'
      );
    })
  );
}

async function fetchMe(
  request: NextRequest,
): Promise<MeResponse | null> {
  try {
    const response = await fetch(
      `${APIGW.replace(/\/+$/, '')}/api/auth/me`,
      {
        method: 'GET',
        headers: {
          cookie:
            request.headers.get('cookie') || '',
          'x-admin-origin':
            request.nextUrl.origin,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) return null;

    const text = await response.text();

    return text
      ? JSON.parse(text) as MeResponse
      : null;
  }
  catch {
    return null;
  }
}

function redirectToSignin(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = '/auth/signin';
  url.search = `?next=${encodeURIComponent(
    pathname + (search || ''),
  )}`;

  return NextResponse.redirect(url);
}

function redirectHome(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';

  return NextResponse.redirect(url);
}

export async function middleware(
  request: NextRequest,
) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const rule = RULES.find((entry) =>
    pathname.startsWith(entry.prefix),
  );

  if (!rule) return NextResponse.next();

  const me = await fetchMe(request);

  if (!me?.authenticated || !me.user) {
    return redirectToSignin(request);
  }

  if (hasSuperAuthority(me.user)) {
    return NextResponse.next();
  }

  const scopes = Array.isArray(me.user.scopes)
    ? me.user.scopes
    : [];
  const authorised = rule.required.some((scope) =>
    scopes.includes(scope),
  );

  return authorised
    ? NextResponse.next()
    : redirectHome(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\.(?:png|jpg|ico|svg)).*)',
  ],
};
